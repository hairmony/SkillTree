import json
import sqlite3
from contextlib import contextmanager
import numpy as np

from dag_structure import DAG

# Postgresql stuff, I didn't understand it so I'm not using it rn 
DB_PATH = "skilltree.db"

USER_ID = 1  # local user -- no auth

# user_progress.mastery is the BKT probability the learner knows the concept
# (1.0 when marked mastered by hand). At or above this, the concept is mastered.
MASTERY_THRESHOLD = 0.95

SCHEMA = """
CREATE TABLE IF NOT EXISTS trees (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
    tree_id TEXT NOT NULL REFERENCES trees(id),
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    objectives TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tree_id, id)
);
CREATE TABLE IF NOT EXISTS edges (
    tree_id TEXT NOT NULL REFERENCES trees(id),
    parent_id TEXT NOT NULL,
    child_id TEXT NOT NULL,
    PRIMARY KEY (tree_id, parent_id, child_id)
);
CREATE TABLE IF NOT EXISTS user_progress (
    user_id INTEGER NOT NULL,
    tree_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    mastery REAL NOT NULL DEFAULT 1.0,
    PRIMARY KEY (user_id, tree_id, node_id)
);
CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tree_id TEXT NOT NULL,
    source TEXT NOT NULL,
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS node_content (
    tree_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    details TEXT NOT NULL,
    examples TEXT NOT NULL DEFAULT '[]',
    citations TEXT NOT NULL DEFAULT '[]',
    retrieved TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (tree_id, node_id)
);
CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tree_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_option_id TEXT NOT NULL,
    explanation TEXT NOT NULL,
    difficulty TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tree_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    question_id INTEGER NOT NULL UNIQUE,
    correct INTEGER NOT NULL,
    answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

def add_chunks(tree_id: str, source: str, chunks: list[str],
               embeddings: list[list[float]]) -> None:
    rows = [
        (tree_id, source, i, text, np.asarray(emb, dtype=np.float32).tobytes())
        for i, (text, emb) in enumerate(zip(chunks, embeddings))
    ]
    with connect() as conn:
        conn.executemany(
            "INSERT INTO chunks (tree_id, source, position, text, embedding) "
            "VALUES (?, ?, ?, ?, ?)",
            rows,
        )


def search_chunks(tree_id: str, query_embedding: list[float], k: int = 3) -> list[dict]:
    q = np.asarray(query_embedding, dtype=np.float32)
    q = q / np.linalg.norm(q)
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, source, text, embedding FROM chunks WHERE tree_id = ?",
            (tree_id,),
        ).fetchall()
    scored = []
    for chunk_id, source, text, blob in rows:
        v = np.frombuffer(blob, dtype=np.float32)
        score = float(np.dot(q, v) / np.linalg.norm(v))
        scored.append({"id": chunk_id, "source": source, "text": text,
                       "score": round(score, 4)})
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored[:k]

@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


def tree_exists(tree_id: str) -> bool:
    with connect() as conn:
        row = conn.execute("SELECT 1 FROM trees WHERE id = ?", (tree_id,)).fetchone()
        return row is not None


def save_tree(tree_id: str, title: str, dag: DAG) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO trees (id, title) VALUES (?, ?) "
            "ON CONFLICT(id) DO UPDATE SET title = excluded.title",
            (tree_id, title),
        )
        conn.execute("DELETE FROM nodes WHERE tree_id = ?", (tree_id,))
        conn.execute("DELETE FROM node_content WHERE tree_id = ?", (tree_id,))
        conn.execute("DELETE FROM quiz_questions WHERE tree_id = ?", (tree_id,))
        conn.executemany(
            "INSERT INTO nodes (tree_id, id, title, description, objectives) "
            "VALUES (?, ?, ?, ?, ?)",
            [(tree_id, n.id, n.title, n.description, json.dumps(n.objectives))
             for n in dag.nodes],
        )
        conn.executemany(
            "INSERT INTO edges (tree_id, parent_id, child_id) VALUES (?, ?, ?)",
            [(tree_id, e.parent_id, e.child_id) for e in dag.edges],
        )


def get_dag(tree_id: str) -> DAG | None:
    if not tree_exists(tree_id):
        return None
    with connect() as conn:
        nodes = conn.execute(
            "SELECT id, title, description, objectives FROM nodes WHERE tree_id = ?",
            (tree_id,),
        ).fetchall()
        edges = conn.execute(
            "SELECT parent_id, child_id FROM edges WHERE tree_id = ?",
            (tree_id,),
        ).fetchall()
    return DAG.model_validate({
        "nodes": [
            {"id": i, "title": t, "description": d, "objectives": json.loads(o)}
            for i, t, d, o in nodes
        ],
        "edges": [{"parent_id": p, "child_id": c} for p, c in edges],
    })


def get_mastery(tree_id: str) -> dict[str, float]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT node_id, mastery FROM user_progress WHERE user_id = ? AND tree_id = ?",
            (USER_ID, tree_id),
        ).fetchall()
    return {n: m for n, m in rows}


def get_mastered(tree_id: str) -> set[str]:
    return {n for n, m in get_mastery(tree_id).items() if m >= MASTERY_THRESHOLD}


def set_mastery(tree_id: str, node_id: str, mastery: float) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO user_progress (user_id, tree_id, node_id, mastery) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, tree_id, node_id) DO UPDATE SET mastery = excluded.mastery",
            (USER_ID, tree_id, node_id, mastery),
        )


def add_mastered(tree_id: str, node_id: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO user_progress (user_id, tree_id, node_id, mastery) "
            "VALUES (?, ?, ?, 1.0) "
            "ON CONFLICT(user_id, tree_id, node_id) DO UPDATE SET mastery = excluded.mastery",
            (USER_ID, tree_id, node_id),
        )


def reset_progress(tree_id: str) -> None:
    with connect() as conn:
        for table in ("user_progress", "quiz_attempts"):
            conn.execute(
                f"DELETE FROM {table} WHERE user_id = ? AND tree_id = ?",
                (USER_ID, tree_id),
            )

def list_trees() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT id, title FROM trees ORDER BY title").fetchall()
    return [{"id": i, "title": t} for i, t in rows]

def get_tree_title(tree_id: str) -> str | None:
    with connect() as conn:
        row = conn.execute("SELECT title FROM trees WHERE id = ?", (tree_id,)).fetchone()
    return row[0] if row else None


def get_node_content(tree_id: str, node_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT details, examples, citations, retrieved FROM node_content "
            "WHERE tree_id = ? AND node_id = ?",
            (tree_id, node_id),
        ).fetchone()
    if row is None:
        return None
    details, examples, citations, retrieved = row
    return {"details": details, "examples": json.loads(examples),
            "citations": json.loads(citations), "retrieved": json.loads(retrieved)}


def save_node_content(tree_id: str, node_id: str, details: str, examples: list[str],
                      citations: list[int], retrieved: list[int]) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO node_content (tree_id, node_id, details, examples, citations, retrieved) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(tree_id, node_id) DO UPDATE SET details = excluded.details, "
            "examples = excluded.examples, citations = excluded.citations, "
            "retrieved = excluded.retrieved",
            (tree_id, node_id, details, json.dumps(examples),
             json.dumps(citations), json.dumps(retrieved)),
        )


def get_chunks_by_ids(ids: list[int]) -> dict[int, dict]:
    if not ids:
        return {}
    marks = ",".join("?" * len(ids))
    with connect() as conn:
        rows = conn.execute(
            f"SELECT id, source, text FROM chunks WHERE id IN ({marks})", ids
        ).fetchall()
    return {i: {"source": s, "text": t} for i, s, t in rows}

def save_questions(tree_id: str, node_id: str, questions: list[dict]) -> list[int]:
    ids = []
    with connect() as conn:
        for q in questions:
            cur = conn.execute(
                "INSERT INTO quiz_questions (tree_id, node_id, question, options, "
                "correct_option_id, explanation, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (tree_id, node_id, q["text"], json.dumps(q["options"]),
                 q["correct_option_id"], q["explanation"], q["difficulty"]),
            )
            ids.append(cur.lastrowid)
    return ids


def get_question(question_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT tree_id, node_id, question, options, correct_option_id, explanation, "
            "difficulty, EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.question_id = q.id) "
            "FROM quiz_questions q WHERE id = ?",
            (question_id,),
        ).fetchone()
    if row is None:
        return None
    t, n, q, o, c, e, d, answered = row
    return {"id": question_id, "tree_id": t, "node_id": n, "question": q,
            "options": json.loads(o), "correct_option_id": c, "explanation": e,
            "difficulty": d, "answered": bool(answered)}


def add_attempt(tree_id: str, node_id: str, question_id: int, correct: bool) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO quiz_attempts (user_id, tree_id, node_id, question_id, correct) "
            "VALUES (?, ?, ?, ?, ?)",
            (USER_ID, tree_id, node_id, question_id, int(correct)),
        )


def get_attempts(tree_id: str, node_id: str) -> list[bool]:
    """This learner's answers for one concept, oldest first."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT correct FROM quiz_attempts WHERE user_id = ? AND tree_id = ? "
            "AND node_id = ? ORDER BY id",
            (USER_ID, tree_id, node_id),
        ).fetchall()
    return [bool(r[0]) for r in rows]


def delete_tree(tree_id: str) -> None:
    with connect() as conn:
        for table in ("node_content", "user_progress", "chunks", "edges", "nodes",
                      "quiz_questions", "quiz_attempts"):
            conn.execute(f"DELETE FROM {table} WHERE tree_id = ?", (tree_id,))
        conn.execute("DELETE FROM trees WHERE id = ?", (tree_id,))