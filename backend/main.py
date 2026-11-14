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
from ollama_client import embed

import dag_generate
import knowledge_tracer
from quiz_generator import get_quiz_generator

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
    mastery = database.get_mastery(tree_id)
    return {
        "nodes": [{**n.model_dump(), "status": status[n.id],
                   "mastery": round(mastery.get(n.id, 0.0), 3)} for n in dag.nodes],
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


def target_difficulty(mastery: float) -> str:
    # Bands from adaptive-knowledge-graph (student/models.py, policy band-v1)
    if mastery < 0.4:
        return "easy"
    if mastery <= 0.7:
        return "medium"
    return "hard"


@app.post("/trees/{tree_id}/nodes/{node_id}/quiz")
def new_quiz(tree_id: str, node_id: str, num_questions: int = 3):
    dag = get_tree(tree_id)
    node = next((n for n in dag.nodes if n.id == node_id), None)
    if node is None:
        raise HTTPException(404, "node not found")
    if compute_status(dag, database.get_mastered(tree_id))[node_id] == "locked":
        raise HTTPException(409, "node is locked")
    mastery = database.get_mastery(tree_id).get(node_id, 0.0)
    difficulty = target_difficulty(mastery)
    try:
        quiz = get_quiz_generator(tree_id).generate_from_topic(
            f"{node.title}. {node.description}", max(1, min(num_questions, 10)), difficulty)
    except httpx.ConnectError:
        raise HTTPException(503, "Can't reach Ollama. Is it running?")
    except httpx.ReadTimeout:
        raise HTTPException(504, "Ollama took too long to answer.")
    except ValueError as e:
        raise HTTPException(422, str(e))
    questions = [q.model_dump() for q in quiz.questions]
    ids = database.save_questions(tree_id, node_id, questions)
    return {
        "node_id": node_id,
        "difficulty": difficulty,
        "mastery": round(mastery, 3),
        # correct answers stay on the server
        "questions": [{"id": i, "text": q["text"], "options": q["options"]}
                      for i, q in zip(ids, questions)],
    }


class AnswerRequest(BaseModel):
    option_id: str


@app.post("/quiz/{question_id}/answer")
def answer_question(question_id: int, req: AnswerRequest):
    q = database.get_question(question_id)
    if q is None:
        raise HTTPException(404, "question not found")
    if q["answered"]:
        raise HTTPException(409, "question already answered")
    if req.option_id not in {o["id"] for o in q["options"]}:
        raise HTTPException(422, "unknown option")

    correct = req.option_id == q["correct_option_id"]
    database.add_attempt(q["tree_id"], q["node_id"], question_id, correct)
    history = database.get_attempts(q["tree_id"], q["node_id"])
    mastery = knowledge_tracer.compute_mastery_from_sequence(history, "multiple_choice")
    database.set_mastery(q["tree_id"], q["node_id"], mastery)

    return {
        "correct": correct,
        "correct_option_id": q["correct_option_id"],
        "explanation": q["explanation"],
        "mastery": round(mastery, 3),
        "tree": read_tree(q["tree_id"]),
    }


@app.delete("/trees/{tree_id}")
def delete_tree(tree_id: str):
    database.delete_tree(tree_id)
    return {"deleted": tree_id}

# this line messes with API stuff. KEEP LAST!!!!
app.mount("/viewer", StaticFiles(directory="static", html=True), name="viewer")
