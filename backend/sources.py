"""Finds learning material for a topic across free sources (no API keys, no quotas).

- YouTube: search with yt-dlp, transcripts with youtube-transcript-api (with timestamps)
- Papers: OpenAlex, peer-reviewed only (journal / conference articles); full text from
  the open-access PDF when there is one, otherwise the abstract
- Wikipedia and Wikibooks: MediaWiki API, plain-text extracts
- Web: DuckDuckGo via ddgs + trafilatura. Unofficial and sometimes blocked, so it is
  best-effort only.

Every search function returns a list of Doc and never raises: a source that fails is
logged and skipped so the others still run.
"""
import io
import logging
from dataclasses import dataclass, field

import httpx

log = logging.getLogger(__name__)

# Wikimedia rejects requests without a descriptive User-Agent that has a contact URL.
USER_AGENT = ("SkillTree/0.1 (https://github.com/hairmony/SkillTree; "
              "educational research prototype)")
HEADERS = {"User-Agent": USER_AGENT}
TIMEOUT = 30
MAX_CHARS = 40_000          # per document, so one huge page can't drown the rest
MAX_PDF_BYTES = 15_000_000
MAX_PDF_PAGES = 12
MAX_VIDEO_SECONDS = 2 * 60 * 60


@dataclass
class Doc:
    source_type: str   # "video" | "paper" | "wikipedia" | "wikibooks" | "web"
    title: str
    url: str
    text: str = ""
    # for videos: (start_seconds, text) pieces so chunks can link to the right moment
    segments: list[tuple[float, str]] = field(default_factory=list)


def _safe(name: str, fn, *args) -> list[Doc]:
    try:
        return fn(*args)
    except Exception as e:  # noqa: BLE001 - one broken source must not stop the rest
        log.warning("Source %s failed: %s: %s", name, type(e).__name__, e)
        return []


# ---------------------------------------------------------------- YouTube

def _youtube(query: str, n: int) -> list[Doc]:
    import yt_dlp
    from youtube_transcript_api import YouTubeTranscriptApi

    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "extract_flat": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        found = ydl.extract_info(f"ytsearch{n * 2}:{query}", download=False)["entries"]

    api, docs = YouTubeTranscriptApi(), []
    for v in found:
        if len(docs) >= n:
            break
        if not v.get("id") or (v.get("duration") or 0) > MAX_VIDEO_SECONDS:
            continue
        try:
            snippets = list(api.fetch(v["id"], languages=["en", "en-US", "en-GB"]))
        except Exception as e:  # no English transcript, disabled, rate limited...
            log.info("No transcript for %s: %s", v["id"], type(e).__name__)
            continue
        segments = [(s.start, s.text.replace("\n", " ").strip()) for s in snippets
                    if s.text.strip() and not s.text.strip().startswith("[")]
        if segments:
            docs.append(Doc("video", v.get("title") or v["id"],
                            f"https://www.youtube.com/watch?v={v['id']}", segments=segments))
    return docs


def search_youtube(query: str, n: int = 3) -> list[Doc]:
    return _safe("youtube", _youtube, query, n)


# ---------------------------------------------------------------- Papers (OpenAlex)

def _abstract(inverted: dict | None) -> str:
    if not inverted:
        return ""
    words = sorted((pos, w) for w, positions in inverted.items() for pos in positions)
    return " ".join(w for _, w in words)


def _pdf_text(url: str) -> str:
    from pypdf import PdfReader

    with httpx.stream("GET", url, headers=HEADERS, timeout=TIMEOUT,
                      follow_redirects=True) as r:
        r.raise_for_status()
        if "pdf" not in r.headers.get("content-type", "").lower():
            return ""
        data = b""
        for part in r.iter_bytes():
            data += part
            if len(data) > MAX_PDF_BYTES:
                return ""
    reader = PdfReader(io.BytesIO(data))
    pages = [p.extract_text() or "" for p in reader.pages[:MAX_PDF_PAGES]]
    return "\n\n".join(p.strip() for p in pages if p.strip())


def _papers(query: str, n: int) -> list[Doc]:
    r = httpx.get("https://api.openalex.org/works", headers=HEADERS, timeout=TIMEOUT, params={
        "search": query,
        "per-page": n * 2,
        # peer-reviewed: journal or conference articles/reviews (no preprints, theses...)
        "filter": "type:article|review,primary_location.source.type:journal|conference",
        "select": "id,doi,display_name,abstract_inverted_index,primary_location,"
                  "best_oa_location,publication_year",
    })
    r.raise_for_status()
    docs = []
    for w in r.json().get("results", []):
        if len(docs) >= n:
            break
        abstract = _abstract(w.get("abstract_inverted_index"))
        text = ""
        pdf = (w.get("best_oa_location") or {}).get("pdf_url")
        if pdf:
            try:
                text = _pdf_text(pdf)
            except Exception as e:
                log.info("PDF unavailable for %s: %s", w.get("id"), type(e).__name__)
        text = text or abstract
        if len(text) < 200:  # nothing usable
            continue
        venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name")
        title = w.get("display_name") or "Untitled paper"
        if venue:
            title = f"{title} ({venue}, {w.get('publication_year')})"
        url = w.get("doi") or (w.get("primary_location") or {}).get("landing_page_url") or w["id"]
        docs.append(Doc("paper", title, url, text=text))
    return docs


def search_papers(query: str, n: int = 4) -> list[Doc]:
    return _safe("papers", _papers, query, n)


# ---------------------------------------------------------------- Wikipedia / Wikibooks

def _mediawiki(site: str, source_type: str, query: str, n: int) -> list[Doc]:
    api = f"https://{site}/w/api.php"
    hits = httpx.get(api, headers=HEADERS, timeout=TIMEOUT, params={
        "action": "query", "list": "search", "srsearch": query, "srlimit": n,
        "format": "json", "formatversion": 2,
    })
    hits.raise_for_status()
    results = hits.json().get("query", {}).get("search", [])
    if not results:
        return []
    pages = httpx.get(api, headers=HEADERS, timeout=TIMEOUT, params={
        "action": "query", "prop": "extracts|info", "explaintext": 1, "inprop": "url",
        "pageids": "|".join(str(h["pageid"]) for h in results),
        "format": "json", "formatversion": 2,
    })
    pages.raise_for_status()
    docs = []
    for p in pages.json().get("query", {}).get("pages", []):
        text = (p.get("extract") or "").strip()
        if len(text) >= 300:
            docs.append(Doc(source_type, p["title"], p.get("fullurl", ""), text=text))
    return docs


def search_wikipedia(query: str, n: int = 3) -> list[Doc]:
    return _safe("wikipedia", _mediawiki, "en.wikipedia.org", "wikipedia", query, n)


def search_wikibooks(query: str, n: int = 2) -> list[Doc]:
    return _safe("wikibooks", _mediawiki, "en.wikibooks.org", "wikibooks", query, n)


# ---------------------------------------------------------------- General web (best effort)

SKIP_DOMAINS = ("youtube.com", "wikipedia.org", "wikibooks.org", "reddit.com",
                "facebook.com", "twitter.com", "x.com", "instagram.com", "tiktok.com")


def _web(query: str, n: int) -> list[Doc]:
    import trafilatura  # needs lxml_html_clean; if missing, this source is skipped
    from ddgs import DDGS

    docs = []
    for hit in DDGS().text(query, max_results=n * 3):
        if len(docs) >= n:
            break
        url = hit.get("href", "")
        if not url or any(d in url for d in SKIP_DOMAINS):
            continue
        try:
            r = httpx.get(url, headers=HEADERS, timeout=TIMEOUT, follow_redirects=True)
            r.raise_for_status()
            text = trafilatura.extract(r.text, include_comments=False) or ""
        except Exception as e:
            log.info("Could not read %s: %s", url, type(e).__name__)
            continue
        if len(text) >= 500:
            docs.append(Doc("web", hit.get("title") or url, url, text=text))
    return docs


def search_web(query: str, n: int = 3) -> list[Doc]:
    return _safe("web", _web, query, n)


SEARCHES = [  # (label shown in progress, function, results per query)
    ("videos", search_youtube, 2),
    ("papers", search_papers, 3),
    ("Wikipedia", search_wikipedia, 2),
    ("Wikibooks", search_wikibooks, 1),
    ("web pages", search_web, 2),
]


def trim(doc: Doc) -> Doc:
    doc.text = doc.text[:MAX_CHARS]
    if doc.segments:
        total, kept = 0, []
        for start, t in doc.segments:
            total += len(t) + 1
            if total > MAX_CHARS:
                break
            kept.append((start, t))
        doc.segments = kept
    return doc
