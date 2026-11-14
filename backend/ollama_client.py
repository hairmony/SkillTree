import httpx

OLLAMA_URL = "http://localhost:11434"
EMBED_MODEL = "mxbai-embed-large"

def embed(texts: list[str]) -> list[list[float]]:
    r = httpx.post(
        f"{OLLAMA_URL}/api/embed",
        json={"model": EMBED_MODEL, "input": texts},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["embeddings"]

CHAT_MODEL = "qwen3.5:4b"

def chat_json(prompt: str, schema: dict) -> str:
    r = httpx.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": CHAT_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "format": schema,
            "stream": False,
            "think": False,
            "options": {"num_ctx": 8192},
        },
        timeout=600,
    )
    r.raise_for_status()
    return r.json()["message"]["content"]