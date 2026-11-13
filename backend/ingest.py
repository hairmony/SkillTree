from database import add_chunks
from ollama import embed


def chunk_text(text: str, max_chars: int = 800) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for p in paragraphs:

        # paragraph longer -> gets cut into pieces
        while len(p) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(p[:max_chars])
            p = p[max_chars:]
        if len(current) + len(p) + 2 <= max_chars:
            current = f"{current}\n\n{p}" if current else p
        else:
            if current:
                chunks.append(current)
            current = p
    if current:
        chunks.append(current)
    return chunks


def ingest_text(tree_id: str, source: str, text: str, max_chars: int = 800) -> int:
    chunks = chunk_text(text, max_chars)
    if not chunks:
        return 0
    embeddings: list[list[float]] = []
    for i in range(0, len(chunks), 16):
        embeddings.extend(embed(chunks[i:i + 16]))
    add_chunks(tree_id, source, chunks, embeddings)
    return len(chunks)