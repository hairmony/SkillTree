import ConceptMap from "../ConceptMap";
import KnowledgeGaps from "./KnowledgeGaps";
import { useRead } from "./Learning";
import React, { useState } from "react";
import {
  CreateTreeAction,
  Experience,
  Icon,
  PageTitle,
  TreeCard,
  done,
  percent,
  url,
} from "../ui";
import { LABELS, TITLES } from "../labels";
import { ACHIEVEMENTS } from "../achievements";
// Stat row (skill trees, concepts completed, quizzes taken, average score),
// shown on the Dashboard and Analytics tabs.
function Metrics({ trees }) {
  const quizzes = trees.flatMap((t) => t.history);
  // icons are in assets/analytics/
  const metrics = [
    ["skill-trees", trees.length, "Skill trees", "mint"],
    [
      "concepts-completed",
      trees.reduce((sum, t) => sum + done(t), 0),
      "Concepts completed",
      "lilac",
    ],
    ["quizzes-taken", quizzes.length, "Quizzes taken", "gold"],
    [
      "average-score",
      quizzes.length
        ? percent(quizzes.reduce((s, q) => s + q.score, 0) / quizzes.length)
        : "—",
      "Average score",
      "blue",
    ],
  ];
  return (
    <div className="metrics">
      {metrics.map(([icon, value, label, color]) => (
        <div className="panel metric" key={label}>
          <span className={"round " + color}>
            <Icon name={"analytics/" + icon} />
          </span>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
export function Dashboard({ trees, xp, onDelete, removing }) {
  const current =
    trees.find((t) => t.id === localStorage.getItem("recentTree")) || trees[0];
  const next = current?.nodes.find((n) => n.status === "unlocked");
  return (
    <>
      <PageTitle {...TITLES.PAGES.dashboard}>
        {current && <CreateTreeAction />}
      </PageTitle>
      <section className={"hero" + (current ? " with-map" : "")}>
        {/* no tree yet: decorative terrain; otherwise the recent tree's own map sits here */}
        {!current && <div className="terrain" />}
        <div className="hero-copy">
          <small>
            <i />{" "}
            {current ? "RECENT SKILL TREE" : "START YOUR LEARNING"}
          </small>
          <h2>{current?.title || "Build your first tree"}</h2>
          <p>
            {next
              ? "Up next · " + next.title
              : current
                ? "Explore your concept map and revisit lessons."
                : "Choose a topic to grow in, one step at a time."}
          </p>
          {current && (
            <p className="hero-progress">
              {done(current)} of {current.nodes.length} concepts completed
            </p>
          )}
          {current ? (
            <a className="button light" href={url("map", current.id)}>
              {LABELS.VIEW_FULL_TREE}
            </a>
          ) : (
            <CreateTreeAction />
          )}
        </div>
        {current && (
          <div className="hero-map">
            <ConceptMap tree={current} compact />
          </div>
        )}
      </section>
      <Experience xp={xp} />
      <Metrics trees={trees} />
      <div className="dashboard-bottom">
        <section>
          <div className="section-head">
            <h2>My skill trees</h2>
            <a href={url("trees")}>View all</a>
          </div>
          {trees.slice(0, 3).map((t) => (
            <TreeCard
              key={t.id}
              tree={t}
              onDelete={onDelete}
              removing={removing}
            />
          ))}
          {!trees.length && <p>Your trees will appear here.</p>}
        </section>
        <section>
          <div className="section-head">
            <h2>Learning focus</h2>
          </div>
          <div className="panel focus">
            <small>NEXT STEP</small>
            <h3>{next?.title || "Choose a concept"}</h3>
            <p>
              {next?.description ||
                "Open a skill tree to explore its lessons."}
            </p>
            {current && (
              <a href={url("map", current.id)}>Explore learning map</a>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
export function Trees({ trees, onDelete, removing }) {
  const [query, setQuery] = useState("");
  const matches = trees.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle {...TITLES.PAGES.trees}>
        <CreateTreeAction />
      </PageTitle>
      <input
        className="search"
        aria-label="Search trees"
        placeholder="Search skill trees…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="cards">
        {matches.map((t) => (
          <TreeCard
            key={t.id}
            tree={t}
            onDelete={onDelete}
            removing={removing}
          />
        ))}
      </div>
      {!matches.length && (
        <p>
          {query ? "No matching trees." : "Create a tree to begin learning."}
        </p>
      )}
    </>
  );
}
export function Analytics({ trees }) {
  const [filter, setFilter] = useState("");
  const rows = trees
    .filter((t) => !filter || t.id === filter)
    .flatMap((t) => t.history.map((q) => ({ ...q, tree: t })))
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  return (
    <>
      <PageTitle {...TITLES.PAGES.analytics} />
      <Metrics trees={trees} />
      <label>
        {TITLES.TAB_TITLES.trees}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All trees</option>
          {trees.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <KnowledgeGaps key={filter} rows={rows} />
      <section className="panel pad">
        <h2>Quiz history</h2>
        {rows.map((q) => (
          <a
            className="row"
            href={url("results", q.tree.id, q.node_id)}
            key={q.quiz_id}
          >
            <div>
              <b>{q.title}</b>
              <p>
                {q.tree.title} · {q.submitted_at}
              </p>
            </div>
            <strong>{percent(q.score)}</strong>
          </a>
        ))}
        {!rows.length && (
          <p>
            Your scores and answer reviews will appear after your first
            assessment.
          </p>
        )}
      </section>
    </>
  );
}
export function Achievements({ trees, xp }) {
  // the list itself lives in src/achievements.js
  const quizzes = trees.flatMap((t) => t.history);
  const stats = useRead("/stats").data; // e.g. sources opened
  const awards = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: a.earned({ trees, quizzes, xp, stats }),
  }));
  return (
    <>
      <PageTitle {...TITLES.PAGES.achievements} />
      <Experience xp={xp} />
      <p>
        {awards.filter((a) => a.unlocked).length} of {awards.length} milestones
        earned
      </p>
      <div className="cards">
        {awards.map((a) => (
          <article className="panel pad award" key={a.id}>
            <span className={"round " + (a.unlocked ? "gold" : "muted")}>
              <Icon name={"achievements/" + a.id} />
            </span>
            <small>{a.unlocked ? "EARNED" : "LOCKED"}</small>
            <h2>{a.name}</h2>
            <p>{a.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
