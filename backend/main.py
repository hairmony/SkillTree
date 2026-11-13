import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

import database
from dag_structure import compute_status
from demo import DEMO_DAG

import httpx
from pydantic import BaseModel

import ingest
from ollama import embed

import dag_generate

app = FastAPI(title="SkillTree")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

database.init_db()
if not database.tree_exists("demo"):
    database.save_tree("demo", "Linear Algebra", DEMO_DAG)


def get_tree(tree_id: str):
    dag = database.get_dag(tree_id)
    if dag is None:
        raise HTTPException(404, "tree not found")
    return dag


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/viewer/")


@app.get("/health")
def health():
    return {"ok": True}

@app.get("/trees")
def list_trees():
    return database.list_trees()

@app.get("/trees/{tree_id}")
def read_tree(tree_id: str):
    dag = get_tree(tree_id)
    status = compute_status(dag, database.get_mastered(tree_id))
    return {
        "nodes": [{**n.model_dump(), "status": status[n.id]} for n in dag.nodes],
        "edges": [e.model_dump() for e in dag.edges],
    }


@app.post("/trees/{tree_id}/nodes/{node_id}/mastered")
def mark_mastered(tree_id: str, node_id: str):
    dag = get_tree(tree_id)
    status = compute_status(dag, database.get_mastered(tree_id))
    if node_id not in status:
        raise HTTPException(404, "node not found")
    if status[node_id] == "locked":
        raise HTTPException(409, "node is locked")
    database.add_mastered(tree_id, node_id)
    return read_tree(tree_id)


@app.post("/trees/{tree_id}/reset")
def reset(tree_id: str):
    get_tree(tree_id)
    database.reset_progress(tree_id)
    return read_tree(tree_id)


class IngestTextRequest(BaseModel):
    tree_id: str
    source: str = "pasted text"
    text: str
    max_chars: int = 800


@app.post("/ingest/text")
def ingest_text(req: IngestTextRequest):
    try:
        count = ingest.ingest_text(req.tree_id, req.source, req.text, req.max_chars)
    except httpx.ConnectError:
        raise HTTPException(503, "Can't reach Ollama. Is it running?")
    return {"chunks_added": count}


@app.get("/search")
def search(tree_id: str, q: str, k: int = 3):
    try:
        query_embedding = embed([q])[0]
    except httpx.ConnectError:
        raise HTTPException(503, "Can't reach Ollama. Is it running?")
    return database.search_chunks(tree_id, query_embedding, k)


class GenerateRequest(BaseModel):
    tree_id: str
    topic: str


@app.post("/trees/generate")
def generate_tree(req: GenerateRequest):
    try:
        dag = dag_generate.generate_dag(req.tree_id, req.topic)
    except httpx.ConnectError:
        raise HTTPException(503, "Can't reach Ollama. Is it running?")
    except httpx.ReadTimeout:
        raise HTTPException(504, "Ollama took too long to answer.")
    except ValueError as e:
        raise HTTPException(422, str(e))
    database.save_tree(req.tree_id, req.topic, dag)
    database.reset_progress(req.tree_id)
    return read_tree(req.tree_id)

def strip_passage_numbers(text: str) -> str:
    return re.sub(r"\s*\[\d+\]", "", text).strip()


def source_link(source: str) -> str | None:
    if source.startswith(("http://", "https://")):
        return source
    return None


def with_sources(content: dict) -> dict:
    chunks = database.get_chunks_by_ids(content["citations"])
    sources, seen = [], set()
    for cid in content["citations"]:
        c = chunks.get(cid)
        if c is None:
            continue
        src = c["source"]
        if src in seen:
            continue
        seen.add(src)
        sources.append({"source": src, "url": source_link(src)})
    return {"details": content["details"], "examples": content["examples"],
            "sources": sources}


@app.get("/trees/{tree_id}/nodes/{node_id}/content")
def node_content(tree_id: str, node_id: str):
    dag = get_tree(tree_id)
    if node_id not in {n.id for n in dag.nodes}:
        raise HTTPException(404, "node not found")
    content = database.get_node_content(tree_id, node_id)
    if content is None:
        try:
            dag_generate.generate_node_content(tree_id, node_id)
        except httpx.ConnectError:
            raise HTTPException(503, "Can't reach Ollama. Is it running?")
        except httpx.ReadTimeout:
            raise HTTPException(504, "Ollama took too long to answer.")
        except ValueError as e:
            raise HTTPException(422, str(e))
        content = database.get_node_content(tree_id, node_id)
    return with_sources(content)

@app.delete("/trees/{tree_id}")
def delete_tree(tree_id: str):
    database.delete_tree(tree_id)
    return {"deleted": tree_id}

# this line messes with API stuff. KEEP LAST!!!!
app.mount("/viewer", StaticFiles(directory="static", html=True), name="viewer")