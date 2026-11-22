import json
import sqlite3
from contextlib import contextmanager
import numpy as np

from dag_structure import DAG

# Postgresql stuff, I didn't understand it so I'm not using it rn 
DB_PATH = "skilltree.db"

USER_ID = 1  # local user -- no auth

# user_progress.mastery is the BKT probability the learner knows the concept. It is
# recorded but no longer decides status: a node counts as "mastered" (finished) once
# user_progress.completed is set, i.e. its quiz was taken or it was skipped.
# MASTERY_THRESHOLD is only used to carry over nodes mastered before this change.
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
    kind TEXT NOT NULL DEFAULT 'core',  -- core / required / optional (added after a quiz)
    origin TEXT,                        -- node whose quiz added this one
    depth INTEGER NOT NULL DEFAULT 0,   -- quiz-added levels below a core node
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
    completed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, tree_id, node_id)
);
CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tree_id TEXT NOT NULL,
    source TEXT NOT NULL,
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding BLOB NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'text',  -- video / paper / wikipedia / wikibooks / web / text
    title TEXT,
    url TEXT,
    start_seconds REAL                         -- videos: where this chunk starts
);
CREATE TABLE IF NOT EXISTS tree_jobs (
    tree_id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    state TEXT NOT NULL,                       -- running / done / failed
    message TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    difficulty TEXT NOT NULL,
    practice INTEGER NOT NULL DEFAULT 0,  -- 1 = practice question; doesn't count toward mastery
    quiz_id INTEGER,                      -- quizzes.id
    concept TEXT                          -- the idea the question tests
);
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tree_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TEXT,
    score REAL,                           -- fraction correct, set on submit
    added_nodes TEXT NOT NULL DEFAULT '[]',
    prepared INTEGER NOT NULL DEFAULT 0   -- 1 = made in the background, not shown yet
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tree_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    question_id INTEGER NOT NULL UNIQUE,
    correct INTEGER NOT NULL,
    chosen TEXT,                          -- option id the learner picked
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


def add_doc_chunks(tree_id: str, source_type: str, title: str, url: str,
                   chunks: list[str], starts: list[float | None],
                   embeddings: list[list[float]]) -> None:
    """Chunks from a found source, with where they came from."""
    rows = [
        (tree_id, url or title, i, text, np.asarray(emb, dtype=np.float32).tobytes(),
         source_type, title, url, start)
        for i, (text, start, emb) in enumerate(zip(chunks, starts, embeddings))
    ]
    with connect() as conn:
        conn.executemany(
            "INSERT INTO chunks (tree_id, source, position, text, embedding, source_type, "
            "title, url, start_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )


def count_chunks(tree_id: str) -> int:
    with connect() as conn:
        return conn.execute("SELECT COUNT(*) FROM chunks WHERE tree_id = ?",
                            (tree_id,)).fetchone()[0]


def set_job(tree_id: str, topic: str, state: str, message: str = "") -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO tree_jobs (tree_id, topic, state, message) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(tree_id) DO UPDATE SET state = excluded.state, "
            "message = excluded.message, updated_at = CURRENT_TIMESTAMP",
            (tree_id, topic, state, message),
        )


def get_job(tree_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT topic, state, message, updated_at FROM tree_jobs WHERE tree_id = ?",
            (tree_id,),
        ).fetchone()
    if row is None:
        return None
    return {"tree_id": tree_id, "topic": row[0], "state": row[1], "message": row[2],
            "updated_at": row[3]}


def search_chunks(tree_id: str, query_embedding: list[float], k: int = 3) -> list[dict]:
    q = np.asarray(query_embedding, dtype=np.float32)
    q = q / np.linalg.norm(q)
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, source, text, embedding, source_type, title, url, start_seconds "
            "FROM chunks WHERE tree_id = ?",
            (tree_id,),
        ).fetchall()
    scored = []
    for chunk_id, source, text, blob, stype, title, url, start in rows:
        v = np.frombuffer(blob, dtype=np.float32)
        score = float(np.dot(q, v) / np.linalg.norm(v))
        scored.append({"id": chunk_id, "source": source, "text": text,
                       "source_type": stype, "title": title, "url": url,
                       "start_seconds": start, "score": round(score, 4)})
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
        # Add columns that databases made by earlier versions lack.
        added = {
            "quiz_questions": [("practice", "INTEGER NOT NULL DEFAULT 0"),
                               ("quiz_id", "INTEGER"), ("concept", "TEXT")],
            "nodes": [("kind", "TEXT NOT NULL DEFAULT 'core'"), ("origin", "TEXT"),
                      ("depth", "INTEGER NOT NULL DEFAULT 0")],
            "user_progress": [("completed", "INTEGER NOT NULL DEFAULT 0")],
            "quiz_attempts": [("chosen", "TEXT")],
            "quizzes": [("prepared", "INTEGER NOT NULL DEFAULT 0")],
            "chunks": [("source_type", "TEXT NOT NULL DEFAULT 'text'"), ("title", "TEXT"),
                       ("url", "TEXT"), ("start_seconds", "REAL")],
        }
        for table, columns in added.items():
            have = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
            for name, decl in columns:
                if name not in have:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
                    if (table, name) == ("user_progress", "completed"):
                        # nodes mastered under the old rules stay mastered
                        conn.execute("UPDATE user_progress SET completed = 1 "
                                     "WHERE mastery >= ?", (MASTERY_THRESHOLD,))


def tree_id_in_use(tree_id: str) -> bool:
    """True if a tree, reference text waiting for a tree, or a tree being created
    already has this id."""
    with connect() as conn:
        return conn.execute(
            "SELECT EXISTS(SELECT 1 FROM trees WHERE id = ?) "
            "OR EXISTS(SELECT 1 FROM chunks WHERE tree_id = ?) "
            "OR EXISTS(SELECT 1 FROM tree_jobs WHERE tree_id = ?)",
            (tree_id, tree_id, tree_id),
        ).fetchone()[0] == 1


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
        for table in ("nodes", "edges", "node_content", "quiz_questions", "quizzes"):
            conn.execute(f"DELETE FROM {table} WHERE tree_id = ?", (tree_id,))
    add_nodes(tree_id, dag.nodes, [(e.parent_id, e.child_id) for e in dag.edges])


def add_nodes(tree_id: str, nodes: list, edges: list[tuple[str, str]]) -> None:
    """Insert nodes (dag_structure.Node) and (parent_id, child_id) edges into a tree."""
    with connect() as conn:
        conn.executemany(
            "INSERT INTO nodes (tree_id, id, title, description, objectives, kind, origin, "
            "depth) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(tree_id, n.id, n.title, n.description, json.dumps(n.objectives),
              n.kind, n.origin, n.depth) for n in nodes],
        )
        conn.executemany(
            "INSERT OR IGNORE INTO edges (tree_id, parent_id, child_id) VALUES (?, ?, ?)",
            [(tree_id, p, c) for p, c in edges],
        )


def remove_added_nodes(tree_id: str) -> None:
    """Delete every node added after a quiz, with its edges and study page."""
    with connect() as conn:
        ids = [r[0] for r in conn.execute(
            "SELECT id FROM nodes WHERE tree_id = ? AND kind != 'core'", (tree_id,))]
        for nid in ids:
            conn.execute("DELETE FROM edges WHERE tree_id = ? AND (parent_id = ? OR child_id = ?)",
                         (tree_id, nid, nid))
            conn.execute("DELETE FROM node_content WHERE tree_id = ? AND node_id = ?",
                         (tree_id, nid))
        conn.execute("DELETE FROM nodes WHERE tree_id = ? AND kind != 'core'", (tree_id,))


def get_dag(tree_id: str) -> DAG | None:
    if not tree_exists(tree_id):
        return None
    with connect() as conn:
        nodes = conn.execute(
            "SELECT id, title, description, objectives, kind, origin, depth FROM nodes "
            "WHERE tree_id = ? ORDER BY rowid",
            (tree_id,),
        ).fetchall()
        edges = conn.execute(
            "SELECT parent_id, child_id FROM edges WHERE tree_id = ?",
            (tree_id,),
        ).fetchall()
    return DAG.model_validate({
        "nodes": [
            {"id": i, "title": t, "description": d, "objectives": json.loads(o),
             "kind": k, "origin": org, "depth": dp}
            for i, t, d, o, k, org, dp in nodes
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
    """Finished nodes: quiz taken (any score) or skipped."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT node_id FROM user_progress WHERE user_id = ? AND tree_id = ? "
            "AND completed = 1",
            (USER_ID, tree_id),
        ).fetchall()
    return {r[0] for r in rows}


def set_mastery(tree_id: str, node_id: str, mastery: float) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO user_progress (user_id, tree_id, node_id, mastery) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, tree_id, node_id) DO UPDATE SET mastery = excluded.mastery",
            (USER_ID, tree_id, node_id, mastery),
        )


def add_mastered(tree_id: str, node_id: str) -> None:
    """Mark a node finished. A new row starts at mastery 0: finishing isn't knowing."""
    with connect() as conn:
        conn.execute(
            "INSERT INTO user_progress (user_id, tree_id, node_id, mastery, completed) "
            "VALUES (?, ?, ?, 0.0, 1) "
            "ON CONFLICT(user_id, tree_id, node_id) DO UPDATE SET completed = 1",
            (USER_ID, tree_id, node_id),
        )


def reset_progress(tree_id: str) -> None:
    """Start the tree over: progress, quizzes and quiz-added nodes are removed."""
    with connect() as conn:
        for table in ("user_progress", "quiz_attempts", "quizzes"):
            conn.execute(
                f"DELETE FROM {table} WHERE user_id = ? AND tree_id = ?",
                (USER_ID, tree_id),
            )
        conn.execute("DELETE FROM quiz_questions WHERE tree_id = ?", (tree_id,))
    remove_added_nodes(tree_id)

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
            f"SELECT id, source, text, source_type, title, url, start_seconds FROM chunks "
            f"WHERE id IN ({marks})", ids
        ).fetchall()
    return {i: {"source": s, "text": t, "source_type": st, "title": ti, "url": u,
                "start_seconds": ss} for i, s, t, st, ti, u, ss in rows}

def create_quiz(tree_id: str, node_id: str, questions: list[dict],
                prepared: bool = False) -> tuple[int, list[int]]:
    """Save a new quiz and its questions; returns (quiz_id, question ids).
    prepared=True: made in the background, handed out later by take_prepared_quiz."""
    with connect() as conn:
        quiz_id = conn.execute(
            "INSERT INTO quizzes (user_id, tree_id, node_id, prepared) VALUES (?, ?, ?, ?)",
            (USER_ID, tree_id, node_id, int(prepared)),
        ).lastrowid
        ids = []
        for q in questions:
            ids.append(conn.execute(
                "INSERT INTO quiz_questions (tree_id, node_id, question, options, "
                "correct_option_id, explanation, difficulty, quiz_id, concept) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (tree_id, node_id, q["text"], json.dumps(q["options"]),
                 q["correct_option_id"], q["explanation"], q["difficulty"], quiz_id,
                 q.get("concept")),
            ).lastrowid)
    return quiz_id, ids


def has_prepared_quiz(tree_id: str, node_id: str) -> bool:
    with connect() as conn:
        return conn.execute(
            "SELECT EXISTS(SELECT 1 FROM quizzes WHERE tree_id = ? AND node_id = ? "
            "AND user_id = ? AND prepared = 1 AND submitted_at IS NULL)",
            (tree_id, node_id, USER_ID),
        ).fetchone()[0] == 1


def take_prepared_quiz(tree_id: str, node_id: str, num_questions: int) -> dict | None:
    """Hand out a background-prepared quiz with this many questions, if there is one."""
    with connect() as conn:
        row = conn.execute(
            "SELECT z.id FROM quizzes z WHERE z.tree_id = ? AND z.node_id = ? "
            "AND z.user_id = ? AND z.prepared = 1 AND z.submitted_at IS NULL "
            "AND (SELECT COUNT(*) FROM quiz_questions q WHERE q.quiz_id = z.id) = ? "
            "ORDER BY z.id LIMIT 1",
            (tree_id, node_id, USER_ID, num_questions),
        ).fetchone()
        if row is None:
            return None
        conn.execute("UPDATE quizzes SET prepared = 0 WHERE id = ?", (row[0],))
    return get_quiz(row[0])


def get_quiz(quiz_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT tree_id, node_id, submitted_at, score, added_nodes FROM quizzes "
            "WHERE id = ? AND user_id = ?",
            (quiz_id, USER_ID),
        ).fetchone()
        if row is None:
            return None
        qrows = conn.execute(
            "SELECT id, question, options, correct_option_id, explanation, difficulty, "
            "concept FROM quiz_questions WHERE quiz_id = ? ORDER BY id",
            (quiz_id,),
        ).fetchall()
    t, n, sub, score, added = row
    return {
        "id": quiz_id, "tree_id": t, "node_id": n, "submitted": sub is not None,
        "score": score, "added_nodes": json.loads(added),
        "questions": [{"id": i, "text": q, "options": json.loads(o), "correct_option_id": c,
                       "explanation": e, "difficulty": d, "concept": cp}
                      for i, q, o, c, e, d, cp in qrows],
    }


def submit_quiz(quiz_id: int, tree_id: str, node_id: str, results: dict[int, bool],
                chosen: dict[int, str]) -> float:
    """Record every answer, the score, and mark the node finished. Returns the score."""
    score = sum(results.values()) / len(results) if results else 0.0
    with connect() as conn:
        conn.executemany(
            "INSERT INTO quiz_attempts (user_id, tree_id, node_id, question_id, correct, chosen) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [(USER_ID, tree_id, node_id, qid, int(ok), chosen.get(qid))
             for qid, ok in results.items()],
        )
        conn.execute(
            "UPDATE quizzes SET submitted_at = CURRENT_TIMESTAMP, score = ? WHERE id = ?",
            (score, quiz_id),
        )
    add_mastered(tree_id, node_id)
    return score


def get_latest_quiz_results(tree_id: str, node_id: str) -> dict | None:
    """The most recent submitted quiz for a node, with each answer."""
    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM quizzes WHERE tree_id = ? AND node_id = ? AND user_id = ? "
            "AND submitted_at IS NOT NULL ORDER BY id DESC LIMIT 1",
            (tree_id, node_id, USER_ID),
        ).fetchone()
        if row is None:
            return None
        answers = dict(((qid, (ok, ch)) for qid, ok, ch in conn.execute(
            "SELECT a.question_id, a.correct, a.chosen FROM quiz_attempts a "
            "JOIN quiz_questions q ON q.id = a.question_id WHERE q.quiz_id = ?", (row[0],))))
    quiz = get_quiz(row[0])
    for q in quiz["questions"]:
        ok, ch = answers.get(q["id"], (0, None))
        q["correct"], q["chosen"] = bool(ok), ch
    return quiz


def set_quiz_added_nodes(quiz_id: int, node_ids: list[str]) -> None:
    with connect() as conn:
        conn.execute("UPDATE quizzes SET added_nodes = ? WHERE id = ?",
                     (json.dumps(node_ids), quiz_id))


def get_quiz_history(tree_id: str) -> list[dict]:
    """Submitted quizzes for a tree, newest first."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT z.id, z.node_id, n.title, z.score, z.submitted_at, z.added_nodes, "
            "(SELECT group_concat(q.concept, '|') FROM quiz_questions q "
            " JOIN quiz_attempts a ON a.question_id = q.id "
            " WHERE q.quiz_id = z.id AND a.correct = 0) "
            "FROM quizzes z LEFT JOIN nodes n ON n.tree_id = z.tree_id AND n.id = z.node_id "
            "WHERE z.tree_id = ? AND z.user_id = ? AND z.submitted_at IS NOT NULL "
            "ORDER BY z.id DESC",
            (tree_id, USER_ID),
        ).fetchall()
    return [{"quiz_id": i, "node_id": n, "title": t, "score": s, "submitted_at": at,
             "added_nodes": json.loads(added), "missed_concepts": missed.split("|") if missed else []}
            for i, n, t, s, at, added, missed in rows]


def get_previous_questions(tree_id: str, node_id: str, limit: int = 15) -> list[str]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT question FROM quiz_questions WHERE tree_id = ? AND node_id = ? "
            "ORDER BY id DESC LIMIT ?",
            (tree_id, node_id, limit),
        ).fetchall()
    return [r[0] for r in rows]


def count_quizzes(tree_id: str, node_id: str) -> int:
    with connect() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM quizzes WHERE tree_id = ? AND node_id = ? AND user_id = ?",
            (tree_id, node_id, USER_ID),
        ).fetchone()[0]


def get_question(question_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT tree_id, node_id, question, options, correct_option_id, explanation, "
            "difficulty, practice, "
            "EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.question_id = q.id) "
            "FROM quiz_questions q WHERE id = ?",
            (question_id,),
        ).fetchone()
    if row is None:
        return None
    t, n, q, o, c, e, d, p, answered = row
    return {"id": question_id, "tree_id": t, "node_id": n, "question": q,
            "options": json.loads(o), "correct_option_id": c, "explanation": e,
            "difficulty": d, "practice": bool(p), "answered": bool(answered)}


def add_attempt(tree_id: str, node_id: str, question_id: int, correct: bool) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO quiz_attempts (user_id, tree_id, node_id, question_id, correct) "
            "VALUES (?, ?, ?, ?, ?)",
            (USER_ID, tree_id, node_id, question_id, int(correct)),
        )


def get_attempts(tree_id: str, node_id: str) -> list[bool]:
    """This learner's answers for one concept, oldest first (practice quizzes excluded)."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT a.correct FROM quiz_attempts a "
            "JOIN quiz_questions q ON q.id = a.question_id "
            "WHERE a.user_id = ? AND a.tree_id = ? AND a.node_id = ? AND q.practice = 0 "
            "ORDER BY a.id",
            (USER_ID, tree_id, node_id),
        ).fetchall()
    return [bool(r[0]) for r in rows]


def delete_tree(tree_id: str) -> None:
    with connect() as conn:
        for table in ("node_content", "user_progress", "chunks", "edges", "nodes",
                      "quiz_questions", "quiz_attempts", "quizzes", "tree_jobs"):
            conn.execute(f"DELETE FROM {table} WHERE tree_id = ?", (tree_id,))
        conn.execute("DELETE FROM trees WHERE id = ?", (tree_id,))