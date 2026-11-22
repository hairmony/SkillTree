from collections.abc import Callable

import numpy as np
from pydantic import BaseModel

import database

import sources
from ollama_client import chat_json, embed

import messages # it wasn't working without this import

CHUNK_CHARS = 800
OVERLAP_CHARS = 150      # text repeated from the end of the previous chunk
MIN_RELEVANCE = 0.45     # cosine similarity to the topic below which a found source is dropped
MAX_DOCS = 14            # most sources kept per tree, best matches first


def chunk_text(text: str, max_chars: int = CHUNK_CHARS,
               overlap: int = OVERLAP_CHARS) -> list[str]:
    """Paragraph-aware chunks of about max_chars. Each chunk after the first starts with
    the last `overlap` characters of the previous one, so an idea that falls on a chunk
    boundary is still whole in one of them."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    pieces: list[str] = []
    for p in paragraphs:  # paragraphs longer than a chunk are cut, at a space if possible
        while len(p) > max_chars:
            cut = p.rfind(" ", max_chars // 2, max_chars)
            cut = cut if cut > 0 else max_chars
            pieces.append(p[:cut].strip())
            p = p[cut:].strip()
        if p:
            pieces.append(p)

    chunks: list[str] = []
    current = ""
    for p in pieces:
        if current and len(current) + len(p) + 2 > max_chars:
            chunks.append(current)
            tail = current[-overlap:]
            tail = tail[tail.find(" ") + 1:] if " " in tail else tail  # start on a word
            current = f"{tail}\n\n{p}" if overlap else p
        else:
            current = f"{current}\n\n{p}" if current else p
    if current:
        chunks.append(current)
    return chunks


def chunk_segments(segments: list[tuple[float, str]],
                   max_chars: int = CHUNK_CHARS) -> tuple[list[str], list[float]]:
    """Group transcript lines into chunks, remembering when each chunk starts."""
    chunks, starts, current, start = [], [], [], None
    size = 0
    for t, line in segments:
        if current and size + len(line) + 1 > max_chars:
            chunks.append(" ".join(current))
            starts.append(start)
            current, size = [], 0
        if not current:
            start = t
        current.append(line)
        size += len(line) + 1
    if current:
        chunks.append(" ".join(current))
        starts.append(start)
    return chunks, starts


def _embed_all(texts: list[str],
               on_batch: Callable[[int, int, int], None] | None = None) -> list[list[float]]:
    """Embed in batches of 16. on_batch(first, last, total) is called before each batch
    (1-based chunk numbers) so progress can be shown."""
    out: list[list[float]] = []
    for i in range(0, len(texts), 16):
        if on_batch:
            on_batch(i + 1, min(i + 16, len(texts)), len(texts))
        out.extend(embed(texts[i:i + 16]))
    return out


def ingest_text(tree_id: str, source: str, text: str, max_chars: int = CHUNK_CHARS) -> int:
    """Pasted text (the user's own material)."""
    chunks = chunk_text(text, max_chars)
    if not chunks:
        return 0
    url = source if source.startswith(("http://", "https://")) else ""
    database.add_doc_chunks(tree_id, "text", source, url, chunks, [None] * len(chunks),
                            _embed_all(chunks))
    return len(chunks)


def ingest_doc(tree_id: str, doc: sources.Doc,
               on_batch: Callable[[int, int, int], None] | None = None) -> int:
    if doc.segments:
        chunks, starts = chunk_segments(doc.segments)
    else:
        chunks = chunk_text(doc.text)
        starts = [None] * len(chunks)
    if not chunks:
        return 0
    database.add_doc_chunks(tree_id, doc.source_type, doc.title, doc.url, chunks, starts,
                            _embed_all(chunks, on_batch))
    return len(chunks)


class Queries(BaseModel):
    queries: list[str]


def search_queries(topic: str, description: str = "") -> list[str]:
    """The topic itself plus up to 2 focused searches written by the local model."""
    goal = f"\nWhat they want from it: {description}\n" if description else ""
    prompt = (f"Someone wants to learn: {topic}\n{goal}\nWrite 2 short search queries (3 to 6 words each) that would find good explanations of the core ideas of this topic" 
              + (", focused on what they want" if description else "") 
              + ". Return them as a list called queries.")
    try:
        extra = Queries.model_validate_json(chat_json(prompt, Queries.model_json_schema())).queries
    except Exception:  # the topic alone still works
        extra = []
    queries = [topic] + [q.strip() for q in extra if q.strip()]
    return list(dict.fromkeys(queries))[:3]


def ingest_topic(tree_id: str, topic: str,
                 progress: Callable[[str], None] = lambda m: None,
                 description: str = "") -> dict[str, int]:
    """Search every source for the topic, keep the relevant results, and store them as chunks. Returns how many sources of each type were kept."""
    progress(messages.PLANNING)
    queries = search_queries(topic, description)

    found: dict[str, sources.Doc] = {}
    for label, search, per_query in sources.SEARCHES:
        progress(messages.searching(label, len(found)))
        for q in queries:
            for doc in search(q, per_query):
                if doc.url not in found:
                    found[doc.url] = sources.trim(doc)
    docs = list(found.values())
    if not docs:
        return {}

    progress(messages.checking(len(docs)))
    previews = [f"{d.title}. {(d.text or ' '.join(t for _, t in d.segments))[:1000]}"
                for d in docs]
    target = f"{topic}. {description}" if description else topic
    vecs = np.asarray(_embed_all([target] + previews), dtype=np.float32)
    vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
    scores = vecs[1:] @ vecs[0]
    ranked = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
    keep = [d for s, d in ranked if s >= MIN_RELEVANCE][:MAX_DOCS]

    counts: dict[str, int] = {}
    for i, doc in enumerate(keep, 1):
        label = messages.reading(i, len(keep), doc.title)
        progress(label)

        def show(first: int, last: int, total: int, label: str = label) -> None:
            progress(messages.reading_chunks(label, first, last, total))

        if ingest_doc(tree_id, doc, show):
            counts[doc.source_type] = counts.get(doc.source_type, 0) + 1
    return counts
