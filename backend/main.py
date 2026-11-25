import re
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

import numpy as np

import database
from dag_structure import Node, compute_status
from demo import ARCHITECTURE_DAG, ARCHITECTURE_SHOWN_UNLOCKED, DEMO_DAG

import httpx
from pydantic import BaseModel

import ingest
from ollama_client import embed

import background
import dag_generate
import knowledge_tracer
import xp
from quiz_generation import ContentNotFoundError, build_quiz

import messages

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
# Sample tree with SkillTree's own architecture (ARCHITECTURE_DAG in demo.py). Not
# created automatically, so it stays deleted; to bring it back, run once:
#   database.save_tree("architecture", "SkillTree Architecture", ARCHITECTURE_DAG)


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
    if tree_id == "architecture":  # sample tree: show these as unlocked (display only)
        status.update({n: "unlocked" for n in ARCHITECTURE_SHOWN_UNLOCKED
                       if status.get(n) == "locked"})
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
    queue_unlocked(tree_id)
    return read_tree(tree_id)


@app.post("/trees/{tree_id}/reset")
def reset(tree_id: str):
    get_tree(tree_id)
    database.reset_progress(tree_id)
    queue_unlocked(tree_id)
    return read_tree(tree_id)


class IngestTextRequest(BaseModel):
    tree_id: str | None = None  # optional: generated from topic when left out
    topic: str | None = None
    source: str = "pasted text"
    text: str
    max_chars: int = 800


def new_tree_id(topic: str) -> str:
    """URL-safe id from the topic, with -2, -3, ... added if it's already in use."""
    base = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")[:60].strip("-") or "tree"
    tree_id, i = base, 2
    while database.tree_id_in_use(tree_id):
        tree_id, i = f"{base}-{i}", i + 1
    return tree_id


@app.post("/ingest/text")
def ingest_text(req: IngestTextRequest):
    """Add reference text to a tree. Without tree_id, a new id is made from topic and
    returned, to pass on to /trees/generate."""
    if req.tree_id:
        tree_id = req.tree_id
    elif req.topic and req.topic.strip():
        tree_id = new_tree_id(req.topic)
    else:
        raise HTTPException(422, "give a topic (or a tree_id)")
    try:
        count = ingest.ingest_text(tree_id, req.source, req.text, req.max_chars)
    except httpx.ConnectError:
        raise HTTPException(503, "Can't reach Ollama. Is it running?")
    return {"chunks_added": count, "tree_id": tree_id}


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
    queue_unlocked(req.tree_id)
    return read_tree(req.tree_id)

class CreateRequest(BaseModel):
    topic: str
    description: str = ""            # optional: what exactly the learner wants from it
    text: str | None = None          # optional: the learner's own notes, added too
    source: str = "your material"


def build_tree(tree_id: str, topic: str, text: str | None, source: str,
               description: str = "") -> None:
    """Background: search sources, store them, generate the tree. Progress goes to
    tree_jobs so the page can show it."""
    def progress(message: str) -> None:
        database.set_job(tree_id, topic, "running", message)

    try:
        counts = ingest.ingest_topic(tree_id, topic, progress, description)
        if text and text.strip():
            progress(messages.ADDING_NOTES)
            ingest.ingest_text(tree_id, source, text)
        if database.count_chunks(tree_id) == 0:
            raise ValueError(messages.NO_SOURCES)
        found = messages.found_summary(counts)
        progress(messages.designing(found))
        dag = dag_generate.generate_dag(tree_id, topic, description=description)
        database.save_tree(tree_id, topic, dag)
        database.reset_progress(tree_id)
        queue_unlocked(tree_id)
        database.set_job(tree_id, topic, "done", messages.done(found))
    except httpx.ConnectError:
        database.set_job(tree_id, topic, "failed", messages.OLLAMA_DOWN)
    except httpx.ReadTimeout:
        database.set_job(tree_id, topic, "failed", messages.OLLAMA_SLOW)
    except ValueError as e:
        database.set_job(tree_id, topic, "failed", str(e))
    except Exception as e:  # noqa: BLE001 - report anything else instead of hanging
        database.set_job(tree_id, topic, "failed", messages.unexpected(e))


@app.post("/trees/create")
def create_tree(req: CreateRequest):
    """Start building a tree from just a topic: sources are searched automatically
    (videos, peer-reviewed papers, Wikipedia/Wikibooks, web). Runs in the background;
    poll GET /trees/{tree_id}/status."""
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(422, "give a topic")
    tree_id = new_tree_id(topic)
    database.set_job(tree_id, topic, "running", messages.STARTING)
    threading.Thread(target=build_tree,
                     args=(tree_id, topic, req.text, req.source, req.description.strip()),
                     name=f"build-{tree_id}", daemon=True).start()
    return {"tree_id": tree_id}


@app.get("/trees/{tree_id}/status")
def tree_status(tree_id: str):
    job = database.get_job(tree_id)
    if job is None:
        if database.tree_exists(tree_id):
            return {"tree_id": tree_id, "state": "done", "message": ""}
        raise HTTPException(404, "tree not found")
    return job


def strip_passage_numbers(text: str) -> str:
    return re.sub(r"\s*\[\d+\]", "", text).strip()


def source_link(c: dict) -> str | None:
    """Link for a chunk's source; video links jump to the moment the chunk starts."""
    url = c.get("url") or (c["source"] if c["source"].startswith(("http://", "https://"))
                           else None)
    if url and c.get("source_type") == "video" and c.get("start_seconds") is not None:
        url += f"&t={int(c['start_seconds'])}s"
    return url


# one citation group in lesson text: [1], [1, 3], [3][5] or [3] [5]
CITATION_MARKER = re.compile(r"[ \t]*\[\d+(?:\s*,\s*\d+)*\](?:\s*\[\d+(?:\s*,\s*\d+)*\])*")


def with_sources(content: dict) -> dict:
    """Number the lesson's sources and rewrite each [n] in the text (n = the passage
    the model was shown, i.e. retrieved[n-1]) to the number of its source in that list."""
    retrieved = content.get("retrieved") or []
    chunks = database.get_chunks_by_ids(list(dict.fromkeys(content["citations"] + retrieved)))
    sources, number = [], {}  # number: source key -> position in sources (1-based)

    def source_number(cid):
        c = chunks.get(cid)
        if c is None:
            return None
        key = c.get("url") or c["source"]
        if key not in number:  # one entry per source; a video links to the first cited moment
            number[key] = len(sources) + 1
            sources.append({"source": c["source"], "title": c.get("title") or c["source"],
                            "type": c.get("source_type") or "text", "url": source_link(c)})
        return number[key]

    def renumber(match):
        nums = []
        for n in map(int, re.findall(r"\d+", match.group())):
            s = source_number(retrieved[n - 1]) if 1 <= n <= len(retrieved) else None
            if s and s not in nums:
                nums.append(s)
        return " [" + ", ".join(map(str, sorted(nums))) + "]" if nums else ""  # unknown: drop

    details = CITATION_MARKER.sub(renumber, content["details"])  # sources numbered in text order
    examples = []
    for text in content["examples"]:
        for part in re.split(r"\s+(?=Case:)", text):  # the model sometimes packs all cases into one
            part = CITATION_MARKER.sub(renumber, part).strip()
            if len(part.split()) >= 5:  # drop junk entries such as "citations"
                examples.append(part)
    for cid in content["citations"]:  # cited but never marked in the text: listed after
        source_number(cid)
    return {"details": split_paragraphs(details), "examples": examples, "sources": sources}


SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")
MAX_SENTENCES = 5        # paragraphs longer than this are broken up...
PARAGRAPH_SENTENCES = 4  # ...into paragraphs of this many sentences


def split_paragraphs(text: str) -> str:
    """Keep the model's own paragraphs; only break up ones longer than MAX_SENTENCES
    (e.g. a lesson written as one big block). A lone last sentence joins the paragraph
    before it, so 9 sentences become 4 + 5, not 4 + 4 + 1."""
    paragraphs = []
    for p in re.split(r"\n\s*\n", text.strip()):
        sentences = SENTENCE_END.split(p.strip())
        if len(sentences) <= MAX_SENTENCES:
            paragraphs.append(p.strip())
            continue
        parts = [sentences[i:i + PARAGRAPH_SENTENCES]
                 for i in range(0, len(sentences), PARAGRAPH_SENTENCES)]
        if len(parts[-1]) == 1:
            parts[-2] += parts.pop()
        paragraphs += [" ".join(s) for s in parts]
    return "\n\n".join(p for p in paragraphs if p)


@app.get("/trees/{tree_id}/nodes/{node_id}/content")
def node_content(tree_id: str, node_id: str):
    dag = get_tree(tree_id)
    if node_id not in {n.id for n in dag.nodes}:
        raise HTTPException(404, "node not found")
    content = database.get_node_content(tree_id, node_id)
    if content is None:
        background.claim(tree_id, node_id)  # wait if the background is writing it now
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


PASS_SCORE = 0.75      # below this, a required review node is added before the next node
MAX_ADDED_DEPTH = 2    # quiz-added nodes can themselves add nodes, this many levels deep
MAX_OPTIONAL = 3       # optional branches added per quiz
DUPLICATE_SIMILARITY = 0.85  # an optional branch this similar to an unfinished node is skipped


QUIZ_MIN, QUIZ_MAX = 2, 10  # question counts the quiz page allows
DEFAULT_QUESTIONS = 5  # preselected count; also the size of quizzes prepared in the background


@app.get("/quiz/sizes")
def quiz_sizes():
    return {"min": QUIZ_MIN, "max": QUIZ_MAX, "default": DEFAULT_QUESTIONS}


@app.post("/trees/{tree_id}/nodes/{node_id}/quiz")
def new_quiz(tree_id: str, node_id: str, num_questions: int = DEFAULT_QUESTIONS):
    """A quiz of QUIZ_MIN-QUIZ_MAX questions with an even mix of easy, medium and hard."""
    dag = get_tree(tree_id)
    node = next((n for n in dag.nodes if n.id == node_id), None)
    if node is None:
        raise HTTPException(404, "node not found")
    status = compute_status(dag, database.get_mastered(tree_id))[node_id]
    if status != "unlocked":
        raise HTTPException(409, f"node is {status}")
    count = max(QUIZ_MIN, min(num_questions, QUIZ_MAX))
    quiz = database.take_prepared_quiz(tree_id, node_id, count)
    if quiz is None:
        background.claim(tree_id, node_id)  # wait if the background is writing it now
        quiz = database.take_prepared_quiz(tree_id, node_id, count)
    if quiz is None:
        try:
            questions = build_quiz(tree_id, node, count)
        except httpx.ConnectError:
            raise HTTPException(503, "Can't reach Ollama. Is it running?")
        except httpx.ReadTimeout:
            raise HTTPException(504, "Ollama took too long to answer.")
        except ContentNotFoundError:  # e.g. a sample tree with no source text behind it
            raise HTTPException(422, messages.NO_QUIZ_MATERIAL)
        except ValueError as e:
            raise HTTPException(422, str(e))
        quiz_id, ids = database.create_quiz(tree_id, node_id, questions)
        quiz = {"id": quiz_id, "questions": [{**q, "id": i} for i, q in zip(ids, questions)]}
    return {
        "quiz_id": quiz["id"],
        "node_id": node_id,
        # correct answers stay on the server
        "questions": [{"id": q["id"], "text": q["text"], "options": q["options"],
                       "difficulty": q["difficulty"]}
                      for q in quiz["questions"]],
    }


def prepare_node(tree_id: str, node_id: str) -> None:
    """Background job: write a node's study page, then a quiz to hand out later."""
    dag = database.get_dag(tree_id)
    node = next((n for n in dag.nodes if n.id == node_id), None) if dag else None
    if node is None or node.kind == "optional":
        return
    if compute_status(dag, database.get_mastered(tree_id))[node_id] != "unlocked":
        return
    if database.get_node_content(tree_id, node_id) is None:
        dag_generate.generate_node_content(tree_id, node_id)
    if not database.has_prepared_quiz(tree_id, node_id):
        questions = build_quiz(tree_id, node, DEFAULT_QUESTIONS)
        database.create_quiz(tree_id, node_id, questions, prepared=True)


def queue_unlocked(tree_id: str) -> None:
    """Queue background preparation for unlocked core/required nodes that aren't ready.
    Optional nodes are prepared only when someone opens them."""
    dag = database.get_dag(tree_id)
    if dag is None:
        return
    status = compute_status(dag, database.get_mastered(tree_id))
    for n in dag.nodes:
        if (status[n.id] == "unlocked" and n.kind != "optional"
                and (database.get_node_content(tree_id, n.id) is None
                     or not database.has_prepared_quiz(tree_id, n.id))):
            background.enqueue(tree_id, n.id)


class SubmitRequest(BaseModel):
    answers: dict[int, str]  # question id -> chosen option id


def unique_id(title: str, taken: set[str]) -> str:
    base = dag_generate.slug(title) or "concept"
    nid, i = base, 2
    while nid in taken:
        nid, i = f"{base}_{i}", i + 1
    taken.add(nid)
    return nid


def add_gap_nodes(tree_id: str, dag, node, missed: list[dict], required: bool) -> list[dict]:
    """Generate and insert nodes for what was missed. Returns [{id, title, kind}]."""
    drafts = dag_generate.generate_gap_nodes(tree_id, node, missed, required, MAX_OPTIONAL)
    if not required:
        # skip branches that repeat a node the learner hasn't finished yet
        finished = database.get_mastered(tree_id)
        pending = [n for n in dag.nodes if n.id not in finished and n.id != node.id]
        if pending:
            vecs = np.asarray(embed([f"{d['title']}. {d['description']}" for d in drafts]
                                    + [f"{n.title}. {n.description}" for n in pending]))
            vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
            sims = vecs[:len(drafts)] @ vecs[len(drafts):].T
            drafts = [d for d, row in zip(drafts, sims) if row.max() < DUPLICATE_SIMILARITY]

    taken = {n.id for n in dag.nodes}
    kind = "required" if required else "optional"
    new_nodes = [Node(id=unique_id(d["title"], taken), title=d["title"],
                      description=d["description"], objectives=d["objectives"],
                      kind=kind, origin=node.id, depth=node.depth + 1) for d in drafts]
    edges = [(node.id, n.id) for n in new_nodes]
    if required:
        # put the review node between this node and everything that came after it
        by_id = {n.id: n for n in dag.nodes}
        for e in dag.edges:
            if e.parent_id == node.id and by_id[e.child_id].kind != "optional":
                edges.append((new_nodes[0].id, e.child_id))
    database.add_nodes(tree_id, new_nodes, edges)
    return [{"id": n.id, "title": n.title, "kind": n.kind} for n in new_nodes]


@app.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: int, req: SubmitRequest):
    """Grade a whole quiz. The node counts as mastered (finished) whatever the score.
    Below PASS_SCORE a required review node is added before the next node; otherwise
    each missed idea gets an optional branch."""
    quiz = database.get_quiz(quiz_id)
    if quiz is None:
        raise HTTPException(404, "quiz not found")
    if quiz["submitted"]:
        raise HTTPException(409, "quiz already submitted")
    tree_id, node_id = quiz["tree_id"], quiz["node_id"]
    dag = get_tree(tree_id)
    node = next((n for n in dag.nodes if n.id == node_id), None)
    if node is None:
        raise HTTPException(404, "node no longer exists")
    if compute_status(dag, database.get_mastered(tree_id))[node_id] != "unlocked":
        raise HTTPException(409, "node is not open for a quiz")
    missing = [q["id"] for q in quiz["questions"] if q["id"] not in req.answers]
    if missing:
        raise HTTPException(422, f"answer every question (missing {missing})")

    results, missed, graded = {}, [], []
    for q in quiz["questions"]:
        chosen = req.answers[q["id"]]
        ok = chosen == q["correct_option_id"]
        results[q["id"]] = ok
        text_of = {o["id"]: o["text"] for o in q["options"]}
        graded.append({"id": q["id"], "correct": ok, "chosen": chosen,
                       "correct_option_id": q["correct_option_id"],
                       "explanation": q["explanation"], "concept": q["concept"]})
        if not ok:
            missed.append({"question": q["text"], "concept": q["concept"],
                           "chosen": text_of.get(chosen, chosen),
                           "correct": text_of.get(q["correct_option_id"], "")})

    xp_before = xp.get_xp()
    score = database.submit_quiz(quiz_id, tree_id, node_id, results, req.answers)
    xp_after = xp.get_xp()

    # Mastery (BKT) is still recorded, but no longer decides anything.
    history = database.get_attempts(tree_id, node_id)
    mastery = knowledge_tracer.compute_mastery_from_sequence(history, "multiple_choice")
    database.set_mastery(tree_id, node_id, mastery)

    added, added_error = [], None
    required = score < PASS_SCORE
    if missed and node.depth < MAX_ADDED_DEPTH:
        try:
            added = add_gap_nodes(tree_id, dag, node, missed, required)
            database.set_quiz_added_nodes(quiz_id, [a["id"] for a in added])
        except httpx.ConnectError:
            added_error = "Can't reach Ollama, so no follow-up concepts were added."
        except httpx.ReadTimeout:
            added_error = "Ollama took too long, so no follow-up concepts were added."
        except ValueError as e:
            added_error = f"No follow-up concepts were added: {e}"

    queue_unlocked(tree_id)
    return {
        "score": round(score, 3),
        "pass_score": PASS_SCORE,
        "xp": {**xp_after, "gained": xp_after["xp"] - xp_before["xp"],
               "level_up": xp_after["level"] > xp_before["level"]},
        "passed": not required,
        "mastery": round(mastery, 3),
        "results": graded,
        "added": added,
        "added_error": added_error,
        "tree": read_tree(tree_id),
    }


@app.get("/trees/{tree_id}/nodes/{node_id}/quiz/results")
def quiz_results(tree_id: str, node_id: str):
    """The latest submitted quiz for a node: score, every answer, and nodes it added."""
    dag = get_tree(tree_id)
    quiz = database.get_latest_quiz_results(tree_id, node_id)
    if quiz is None:
        raise HTTPException(404, "no quiz taken for this node")
    titles = {n.id: (n.title, n.kind) for n in dag.nodes}
    return {
        "score": quiz["score"],
        "results": [{"id": q["id"], "text": q["text"], "options": q["options"],
                     "correct": q["correct"], "chosen": q["chosen"],
                     "correct_option_id": q["correct_option_id"],
                     "explanation": q["explanation"], "concept": q["concept"]}
                    for q in quiz["questions"]],
        "added": [{"id": i, "title": titles[i][0], "kind": titles[i][1]}
                  for i in quiz["added_nodes"] if i in titles],
    }


@app.get("/xp")
def get_xp():
    """The learner's total XP and level (see xp.py)."""
    return xp.get_xp()


class SourceOpened(BaseModel):
    url: str


@app.post("/sources/opened")
def source_opened(req: SourceOpened):
    """A lesson source link was clicked; each distinct link counts once (achievements)."""
    database.record_source_opened(req.url[:2000])
    return stats()


class AchievementsUnlocked(BaseModel):
    ids: list[str]


@app.post("/achievements/unlocked")
def achievements_unlocked(req: AchievementsUnlocked):
    """The frontend saw these achievements earned; remember when (first time only)."""
    database.record_achievements([i[:100] for i in req.ids[:100]])
    return stats()


@app.get("/stats")
def stats():
    """Activity the achievements need that isn't in the trees or quizzes, and when each
    achievement was unlocked."""
    return {"sources_opened": database.count_sources_opened(),
            "achievements": database.get_achievements()}


@app.get("/trees/{tree_id}/quizzes")
def quiz_history(tree_id: str):
    """Submitted quizzes for this tree, newest first, with the ideas that were missed."""
    get_tree(tree_id)
    return database.get_quiz_history(tree_id)


@app.delete("/trees/{tree_id}")
def delete_tree(tree_id: str):
    database.delete_tree(tree_id)
    return {"deleted": tree_id}

# Background preparation: start the worker and catch up on anything not ready yet.
background.start(prepare_node)
for _t in database.list_trees():
    queue_unlocked(_t["id"])

# this line messes with API stuff. KEEP LAST!!!!
app.mount("/viewer", StaticFiles(directory="static", html=True), name="viewer")
