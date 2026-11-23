import React, { useEffect, useState } from "react";
import { request, nodePath } from "../api";
import { Icon, Notice, PageTitle, SafeLink, done, url } from "../ui";
import ConceptMap from "../ConceptMap";
import { LABELS } from "../labels";
export function LearningMap({ tree, added }) {
  return (
    <>
      <PageTitle title={tree.title} />
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
          {busy ? LABELS.SEARCHING : LABELS.SEARCH}
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
      {error && <button onClick={reload}>{LABELS.TRY_AGAIN}</button>}
    </Notice>
  );
}
const SMALL_WORDS = /^(a|an|and|as|at|but|by|for|in|nor|of|on|or|the|to|via|vs\.?|with)$/i;
// source type labels: "wikipedia" -> "Wikipedia", "web page" -> "Web Page" (not used on source titles)
function titleCase(text) {
  return String(text).replace(/\S+/g, (word, at) =>
    /[A-Z]/.test(word.slice(1))
      ? word // RAGE, iPhone, JavaScript: leave as written
      : at > 0 && SMALL_WORDS.test(word)
        ? word.toLowerCase()
        : word[0].toUpperCase() + word.slice(1),
  );
}
// a lesson source was opened: counted for the Source Diver achievement
const opened = (url) => () => request("/sources/opened", { url }).catch(() => {});
// lesson text with each [1] / [1, 2] citation number linking to that source
function CitedText({ text, sources }) {
  return text.split(/(\[\d+(?:, \d+)*\])/).map((part, i) => {
    if (i % 2 === 0) return part; // plain text between citations
    const numbers = part.slice(1, -1).split(", ").map(Number);
    return (
      <span className="cite" key={i}>
        [
        {numbers.map((n, j) => {
          const source = sources[n - 1];
          return (
            <React.Fragment key={j}>
              {j > 0 && ", "}
              {/^https?:\/\//i.test(source?.url || "") ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  title={source.title}
                  onClick={opened(source.url)}
                  onAuxClick={opened(source.url)}
                >
                  {n}
                </a>
              ) : (
                n
              )}
            </React.Fragment>
          );
        })}
        ]
      </span>
    );
  });
}
export function Lesson({ tree, node }) {
  const { data, error, reload } = useRead(
    nodePath(tree.id, node.id) + "/content",
  );
  return (
    <>
      <a className="back-link" href={url("map", tree.id)}>
        <Icon name="chevron_left" size={18} />
        {tree.title}
      </a>
      <PageTitle title={node.title} />
      <p>{node.description}</p>
      <div className="lesson-cols">
        <article className="panel pad">
          <h2>Lesson overview</h2>
          {data ? (
            <>
              <div className="prose">
                <CitedText text={data.details} sources={data.sources} />
              </div>
              <h2>Worked examples</h2>
              {data.examples.map((ex, i) => (
                <p className="example" key={i}>
                  <CitedText text={ex} sources={data.sources} />
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
                {LABELS.TAKE_ASSESSMENT}
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
                <small>
                  [{i + 1}] {titleCase(s.type)}
                </small>
                <SafeLink href={s.url} onOpen={opened(s.url)}>
                  {s.title}
                </SafeLink>
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
