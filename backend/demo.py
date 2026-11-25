from dag_structure import DAG

DEMO_DAG = DAG.model_validate({
    "nodes": [
        {"id": "vectors", "title": "Vectors", "description": "Magnitude, direction, and basic operations.", "objectives": ["Add and scale vectors"]},
        {"id": "dot", "title": "Dot Product", "description": "Measuring alignment between vectors.", "objectives": ["Compute a dot product"]},
        {"id": "matrices", "title": "Matrices", "description": "Matrix notation and multiplication.", "objectives": ["Multiply two matrices"]},
        {"id": "linsys", "title": "Linear Systems", "description": "Solving Ax = b.", "objectives": ["Use row reduction"]},
        {"id": "det", "title": "Determinants", "description": "Scaling factor of a transformation.", "objectives": ["Compute a 3x3 determinant"]},
        {"id": "inverse", "title": "Matrix Inverse", "description": "Undoing a transformation.", "objectives": ["Find an inverse"]},
        {"id": "eigen", "title": "Eigenvalues", "description": "Directions a matrix only stretches.", "objectives": ["Find eigenvalues"]},
    ],
    "edges": [
        {"parent_id": "vectors", "child_id": "dot"},
        {"parent_id": "vectors", "child_id": "matrices"},
        {"parent_id": "matrices", "child_id": "linsys"},
        {"parent_id": "matrices", "child_id": "det"},
        {"parent_id": "linsys", "child_id": "inverse"},
        {"parent_id": "det", "child_id": "inverse"},
        {"parent_id": "inverse", "child_id": "eigen"},
        {"parent_id": "dot", "child_id": "eigen"},
    ],
})

# How the architecture tree's nodes are shown, whatever the progress (main.py read_tree).
# Display only: it doesn't count as progress, so no XP or achievements.
ARCHITECTURE_SHOWN_UNLOCKED = {"backend", "ollama", "qwen", "mxbai", "sqlite"}

# SkillTree's own system architecture, drawn as a skill tree (for the presentation)
ARCHITECTURE_DAG = DAG.model_validate({
    "nodes": [
        {"id": "frontend", "title": "Frontend", "description": "React + Vite: the skill tree map, lessons, quizzes, XP and achievements."},
        {"id": "backend", "title": "Backend", "description": "FastAPI (Python): builds trees, writes lessons, grades quizzes. Talks to the frontend over HTTP / JSON."},
        {"id": "ollama", "title": "Ollama", "description": "Runs the AI models locally: free, no API keys."},
        {"id": "sqlite", "title": "SQLite Database", "description": "Trees, progress and quiz history, plus text chunks and their embeddings."},
        {"id": "sources", "title": "Source Search", "description": "Finds learning material for each topic; a source that fails is skipped."},
        {"id": "qwen", "title": "qwen3.5:4b", "description": "Language model: writes trees, lessons and quizzes."},
        {"id": "mxbai", "title": "mxbai-embed-large", "description": "Embedding model: turns text into vectors for search by meaning."},
        {"id": "youtube", "title": "YouTube", "description": "Video transcripts with timestamps (yt-dlp + youtube-transcript-api)."},
        {"id": "openalex", "title": "OpenAlex", "description": "Peer-reviewed journal and conference papers."},
        {"id": "wikipedia", "title": "Wikipedia", "description": "Articles via the MediaWiki API."},
        {"id": "wikibooks", "title": "Wikibooks", "description": "Textbook pages via the MediaWiki API."},
        {"id": "web", "title": "Web", "description": "DuckDuckGo search + trafilatura text extraction."},
    ],
    "edges": [
        {"parent_id": "frontend", "child_id": "backend"},
        {"parent_id": "backend", "child_id": "ollama"},
        {"parent_id": "backend", "child_id": "sqlite"},
        {"parent_id": "backend", "child_id": "sources"},
        {"parent_id": "ollama", "child_id": "qwen"},
        {"parent_id": "ollama", "child_id": "mxbai"},
        {"parent_id": "sources", "child_id": "youtube"},
        {"parent_id": "sources", "child_id": "openalex"},
        {"parent_id": "sources", "child_id": "wikipedia"},
        {"parent_id": "sources", "child_id": "wikibooks"},
        {"parent_id": "sources", "child_id": "web"},
    ],
})