import { useEffect, useRef, useState } from "react";
import { request, treePath } from "./api";

export function useTreeJob(refresh) {
  const [id, setId] = useState(() => sessionStorage.getItem("activeTreeJob"));
  const [status, setStatus] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const starting = useRef(false);

  async function start(payload) {
    if (starting.current || id) return;
    starting.current = true;
    setStatus({ state: "starting", message: "Starting your tree…" });
    try {
      const { tree_id } = await request("/trees/create", payload);
      sessionStorage.setItem("activeTreeJob", tree_id);
      setId(tree_id);
    } catch (error) {
      setStatus({ state: "failed", message: error.message });
    } finally {
      starting.current = false;
    }
  }

  useEffect(() => {
    if (!id) return;
    let active = true,
      timer;
    function finish() {
      sessionStorage.removeItem("activeTreeJob");
      setId(null);
    }
    async function poll() {
      try {
        const result = await request(treePath(id) + "/status");
        if (!active) return;
        if (result.state === "done") await refresh();
        if (!active) return;
        setStatus({ ...result, id });
        if (result.state === "running") timer = setTimeout(poll, 2000);
        else finish();
      } catch (error) {
        if (!active) return;
        const missing = error.status === 404;
        if (missing) finish();
        setStatus({
          state: missing ? "failed" : "paused",
          message: error.message,
        });
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, refresh, attempt]);

  return {
    status,
    start,
    busy: Boolean(id) || status?.state === "starting",
    retry: () => setAttempt((n) => n + 1),
    dismiss: () => setStatus(null),
  };
}
