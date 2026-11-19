import React, { useEffect, useState } from "react";
import { request, treePath, nodePath } from "../api";
import { Icon, Notice, PageTitle, SafeLink, done, percent, url } from "../ui";
import sample from "../sample.json";
const statusText = {
  locked: "Locked",
  unlocked: "Ready to study",
  mastered: "Completed",
};
function layout(tree) {
  const parents = new Map(tree.nodes.map((n) => [n.id, []]));
  tree.edges.forEach((e) => parents.get(e.child_id).push(e.parent_id));
  const levels = new Map();
  function depth(id) {
    if (!levels.has(id))
      levels.set(id, Math.max(0, ...parents.get(id).map((p) => depth(p) + 1)));
    return levels.get(id);
  }
  const columns = [];
  for (const node of tree.nodes) {
    const level = depth(node.id);
    (columns[level] ??= []).push(node);
  }
  const height = Math.max(...columns.map((c) => c.length), 1) * 100 + 20;
  const points = {};
  columns.forEach((col, i) =>
    col.forEach((node, j) => {
      points[node.id] = {
        x: i * 197 + 16,
        y: (height - col.length * 100) / 2 + j * 100 + 15,
      };
    }),
  );
  return { points, height, width: columns.length * 197 + 16 };
}
export function LearningMap({ tree, live }) {
  const [selected, setSelected] = useState(
    tree.nodes.find((n) => n.status === "unlocked")?.id || tree.nodes[0]?.id,
  );
  const node = tree.nodes.find((n) => n.id === selected);
  const { points, width, height } = layout(tree);
  return (
    <>
      <PageTitle label="LEARNING MAP" title={tree.title} />
      <p>
        {tree.nodes.length} concepts · {done(tree)} completed
      </p>
      <section
        className="panel graph-scroll"
        aria-label="Concept prerequisite map"
      >
        <div className="graph" style={{ width, height }}>
          <svg aria-hidden="true" width={width} height={height}>
            {tree.edges.map((e) => {
              const a = points[e.parent_id],
                b = points[e.child_id];
              const x = a.x + 154,
                y = a.y + 32,
                end = b.y + 32;
              return (
                <path
                  key={e.parent_id + "-" + e.child_id}
                  d={`M${x} ${y} C${x + 24} ${y},${b.x - 24} ${end},${b.x} ${end}`}
                  fill="none"
                  stroke="#6c8978"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
          {tree.nodes.map((n) => (
            <button
              key={n.id}
              aria-pressed={selected === n.id}
              className={"graph-node " + n.status}
              style={{ left: points[n.id].x, top: points[n.id].y }}
              onClick={() => setSelected(n.id)}
            >
              <b>{n.title}</b>
              <span>{statusText[n.status]}</span>
            </button>
          ))}
        </div>
      </section>
      {node && (
        <article className="panel pad">
          <small>{node.kind.toUpperCase()} CONCEPT</small>
          <h2>{node.title}</h2>
          <p>{node.description}</p>
          <h3>Learning objectives</h3>
          <ul>
            {node.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          {node.status === "locked" ? (
            <p>
              Prerequisites ·{" "}
              {tree.edges
                .filter((e) => e.child_id === node.id)
                .map((e) => tree.nodes.find((n) => n.id === e.parent_id).title)
                .join(", ")}
            </p>
          ) : (
            <a
              className="button primary"
              href={url("lesson", tree.id, node.id)}
            >
              Open lesson
            </a>
          )}
        </article>
      )}
      <PassageSearch tree={tree} live={live} />
    </>
  );
}
function PassageSearch({ tree, live }) {
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
        <button disabled={!live || busy || !query.trim()}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {!live && <p>Source search is unavailable in the sample tree.</p>}
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
export function Lesson({ tree, node, live }) {
  const { data, error, reload } = useRead(
    nodePath(tree.id, node.id) + "/content",
    live ? null : sample.lesson,
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
