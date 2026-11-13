import json
import sqlite3
from contextlib import contextmanager
import numpy as np

from dag_structure import DAG

# Postgresql stuff, I didn't understand it so I'm not using it rn 
DB_PATH = "skilltree.db"

USER_ID = 1  # local user -- no auth

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


def get_mastered(tree_id: str) -> set[str]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT node_id FROM user_progress WHERE user_id = ? AND tree_id = ?",
            (USER_ID, tree_id),
        ).fetchall()
    return {r[0] for r in rows}


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
        conn.execute(
            "DELETE FROM user_progress WHERE user_id = ? AND tree_id = ?",
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

def delete_tree(tree_id: str) -> None:
    with connect() as conn:
        for table in ("node_content", "user_progress", "chunks", "edges", "nodes"):
            conn.execute(f"DELETE FROM {table} WHERE tree_id = ?", (tree_id,))
        conn.execute("DELETE FROM trees WHERE id = ?", (tree_id,))