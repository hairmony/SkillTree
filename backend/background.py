"""Prepares study pages and quizzes in the background as soon as a node unlocks.

One worker thread works through a queue of (tree_id, node_id) jobs, one at a time
(the local model answers one request at a time anyway). For each job it writes the
node's study page, then a quiz that is saved as "prepared" until someone takes it.

When a request needs a node that is queued but not started yet, it takes the job
over and does the work itself (claim). If the job is already running, the request
waits for it to finish instead of starting a second copy.

Queued jobs live in memory: a server restart drops them, and startup re-queues
whatever still isn't ready.
"""
import logging
import queue
import threading
from collections.abc import Callable

import httpx

log = logging.getLogger(__name__)

WAIT_SECONDS = 900  # longest a request waits for a running job

_jobs: queue.Queue = queue.Queue()
_lock = threading.Lock()
_queued: set[tuple[str, str]] = set()
_running: tuple[str, str] | None = None
_running_done = threading.Event()
_prepare: Callable[[str, str], None] | None = None
_started = False


def start(prepare: Callable[[str, str], None]) -> None:
    """Start the worker. prepare(tree_id, node_id) does the work for one node."""
    global _prepare, _started
    _prepare = prepare
    with _lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_worker, name="skilltree-prepare", daemon=True).start()


def enqueue(tree_id: str, node_id: str) -> None:
    key = (tree_id, node_id)
    with _lock:
        if key in _queued or key == _running:
            return
        _queued.add(key)
    _jobs.put(key)


def claim(tree_id: str, node_id: str) -> None:
    """Call before doing a node's work in a request: cancels its queued job, or waits
    for it if it's running right now."""
    key = (tree_id, node_id)
    with _lock:
        if key != _running:
            _queued.discard(key)  # the worker skips it when it comes up
            return
        done = _running_done
    done.wait(WAIT_SECONDS)


def _worker() -> None:
    global _running, _running_done
    while True:
        key = _jobs.get()
        with _lock:
            if key not in _queued:  # cancelled by claim(), or a stale duplicate
                continue
            _queued.discard(key)
            _running, _running_done = key, threading.Event()
            done = _running_done
        try:
            _prepare(*key)
        except (ValueError, httpx.HTTPError) as e:
            # expected: no reference text, model gave bad output, Ollama not running
            log.warning("Background preparation skipped for %s/%s: %s", *key, e)
        except Exception:
            # Ollama down, model gave bad output, node deleted... the request path
            # will simply generate it on demand later.
            log.exception("Background preparation failed for %s/%s", *key)
        finally:
            with _lock:
                _running = None
            done.set()
