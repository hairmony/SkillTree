import React, { useEffect, useState } from "react";
import { request, nodePath } from "../api";
import { Notice, PageTitle, SafeLink, done, url } from "../ui";
import ConceptMap from "../ConceptMap";
export function LearningMap({ tree, added }) {
  return (
    <>
      <PageTitle label="LEARNING MAP" title={tree.title} />
      <p>
        {done(tree)} of {tree.nodes.length} concepts completed
      </p>
      <ConceptMap tree={tree} added={added} />
      <PassageSearch tree={tree} />
    </>
  );
}
function PassageSearch({ tree }) {
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function search(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setRows(null);
    try {
      setRows(
        await request(
          "/search?" +
            new URLSearchParams({ tree_id: tree.id, q: query, k: 5 }),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel pad">
      <h2>Search source passages</h2>
      <form onSubmit={search} className="inline">
        <input
          aria-label="Search source passages"
          placeholder="Search a concept or question"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={busy || !query.trim()}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error && <Notice>{error}</Notice>}
      {rows?.map((r) => (
        <article key={r.id}>
          <h3>
            <SafeLink href={r.url}>{r.title || r.source}</SafeLink>
          </h3>
          <p>{r.text}</p>
        </article>
      ))}
      {rows?.length === 0 && <p>No matching passages.</p>}
    </section>
  );
}
export function useRead(path, local) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    (local ? Promise.resolve(local) : request(path))
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, local, retry]);
  return { data, error, reload: () => setRetry((n) => n + 1) };
}
export function ReadState({ error, reload }) {
  return (
    <Notice>
      {error || "Preparing your study material…"}{" "}
      {error && <button onClick={reload}>Try again</button>}
    </Notice>
  );
}
export function Lesson({ tree, node }) {
  const { data, error, reload } = useRead(
    nodePath(tree.id, node.id) + "/content",
  );
  return (
    <>
      <a href={url("map", tree.id)}>‹ {tree.title}</a>
      <PageTitle label="LESSON" title={node.title} />
      <p>{node.description}</p>
      <div className="lesson-cols">
        <article className="panel pad">
          <h2>Lesson overview</h2>
          {data ? (
            <>
              <div className="prose">{data.details}</div>
              <h2>Worked examples</h2>
              {data.examples.map((ex, i) => (
                <p className="example" key={i}>
                  {ex}
                </p>
              ))}
            </>
          ) : (
            <ReadState error={error} reload={reload} />
          )}
        </article>
        <aside>
          <details
            className="panel pad lesson-map"
            open={window.matchMedia("(min-width: 850px)").matches}
          >
            <summary>Learning map</summary>
            <ConceptMap tree={tree} current={node.id} compact />
          </details>
          <section className="panel pad">
            <small>STUDY GUIDE</small>
            <h2>Objectives</h2>
            <ul>
              {node.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            {node.status === "unlocked" && (
              <a
                className="button primary"
                href={url("quiz", tree.id, node.id)}
              >
                Take assessment
              </a>
            )}
            {tree.history.some((q) => q.node_id === node.id) && (
              <a href={url("results", tree.id, node.id)}>Review answers</a>
            )}
          </section>
          <section className="panel pad">
            <h2>Lesson sources</h2>
            {data?.sources.map((s, i) => (
              <p key={i}>
                <small>{s.type}</small>
                <SafeLink href={s.url}>{s.title}</SafeLink>
              </p>
            ))}
            {data && !data.sources.length && (
              <p>No sources returned for this lesson.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
