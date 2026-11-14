"""Every loading / progress message shown while a tree is being built.

Edit the wording here; ingest.py and main.py only call these.
"""

# ---- build steps (in the order they appear)
STARTING = "Planting skill tree..."
PLANNING = "Mapping skill tree..."


def searching(label: str, found_so_far: int) -> str:
    # label: "videos", "papers" etc (in SEARCHES in sources.py)
    return f"Searching {label}... ({found_so_far} sources so far)"


def checking(n_sources: int) -> str:
    return f"Checking {n_sources} sources..."


def reading(i: int, total: int, title: str) -> str:
    return f"Reading source {i} of {total}: {title[:60]}"


def reading_chunks(reading_message: str, first: int, last: int, total: int) -> str:
    chunks = f"chunk {first}" if first == last else f"chunks {first}-{last}"
    return f"{reading_message} ({chunks} of {total})"


ADDING_NOTES = "Adding your material..."


def found_summary(counts: dict[str, int]) -> str:
    # counts: 2 video, 3 paper
    return ", ".join(f"{n} {t}" for t, n in counts.items()) or "user material"


def designing(found: str) -> str:
    return f"Found {found}. Growing the skill tree..."


def done(found: str) -> str:
    return f"Done. Built from {found}."


# ---- failures
NO_SOURCES = ("No usable sources were found for this topic. Try wording it differently or paste your own material.")
OLLAMA_DOWN = "Can't reach Ollama."
OLLAMA_SLOW = "Ollama took too long to answer."


def unexpected(error: Exception) -> str:
    return f"{type(error).__name__}: {error}"
