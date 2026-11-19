import React, { useEffect, useState } from "react";
import { request, treePath } from "../api";
import { go, Notice, PageTitle } from "../ui";
export default function CreateTree({ live, refresh }) {
  const [topic, setTopic] = useState(""),
    [goal, setGoal] = useState(""),
    [notes, setNotes] = useState("");
  const [job, setJob] = useState(
    () => sessionStorage.getItem("activeTreeJob") || "",
  );
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!job || !live) return;
    let active = true,
      timer;
    async function poll() {
      try {
        const status = await request(treePath(job) + "/status");
        if (!active) return;
        setMessage(status.message);
        if (status.state === "done") {
          await refresh();
          if (!active) return;
          sessionStorage.removeItem("activeTreeJob");
          go("map", job);
        } else if (status.state === "failed") {
          sessionStorage.removeItem("activeTreeJob");
          setJob("");
          setError(status.message);
        } else timer = setTimeout(poll, 2000);
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [job, live, retry, refresh]);
  async function submit(e) {
    e.preventDefault();
    if (!topic.trim() || busy || job) return;
    setBusy(true);
    setError("");
    try {
      const data = await request("/trees/create", {
        topic: topic.trim(),
        description: goal.trim(),
        text: notes.trim() || null,
      });
      sessionStorage.setItem("activeTreeJob", data.tree_id);
      setJob(data.tree_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle label="MY TREES" title="Create a learning tree" />
      <form className="panel pad form" onSubmit={submit}>
        <h2>What do you want to learn?</h2>
        <p>
          Choose a topic. Your tree will connect concepts with lessons, sources,
          and quizzes.
        </p>
        <label>
          Topic
          <input
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Neural networks"
          />
        </label>
        <label>
          Learning goal <em>optional</em>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What would you like to understand or build?"
          />
        </label>
        <details>
          <summary>Add reference text</summary>
          <label>
            Notes to include
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </details>
        {!live && (
          <Notice>
            Tree creation is temporarily unavailable. Try again later.
          </Notice>
        )}
        <button
          className="primary"
          disabled={!live || busy || !!job || !topic.trim()}
        >
          {job ? "Growing your tree…" : busy ? "Starting…" : "Generate tree"}
        </button>
        {job && <Notice>{message || "Preparing your learning tree…"}</Notice>}
        {error && (
          <Notice>
            {error}{" "}
            {job && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRetry((r) => r + 1);
                }}
              >
                Check again
              </button>
            )}
          </Notice>
        )}
      </form>
    </>
  );
}
