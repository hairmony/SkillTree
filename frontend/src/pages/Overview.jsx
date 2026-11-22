import ConceptMap from "../ConceptMap";
import KnowledgeGaps from "./KnowledgeGaps";
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
export function Dashboard({ trees, xp, onDelete, removing }) {
  const current =
    trees.find((t) => t.id === localStorage.getItem("recentTree")) || trees[0];
  const next = current?.nodes.find((n) => n.status === "unlocked");
  const quizzes = trees.flatMap((t) => t.history);
  const metrics = [
    ["trees", trees.length, "Learning trees", "mint"],
    [
      "book",
      trees.reduce((sum, t) => sum + done(t), 0),
      "Concepts completed",
      "lilac",
    ],
    ["target", quizzes.length, "Quizzes taken", "gold"],
    [
      "bolt",
      quizzes.length
        ? percent(quizzes.reduce((s, q) => s + q.score, 0) / quizzes.length)
        : "—",
      "Average score",
      "blue",
    ],
  ];
  return (
    <>
      <PageTitle label="YOUR WORKSPACE" title="Learning dashboard">
        {current && <CreateTreeAction />}
      </PageTitle>
      <section className="hero">
        <div className="terrain" />
        <div className="hero-copy">
          <small>
            <i />{" "}
            {current ? "RECENT LEARNING TREE" : "START YOUR LEARNING PATH"}
          </small>
          <h2>{current?.title || "Build your first tree"}</h2>
          <p>
            {next
              ? "Up next · " + next.title
              : current
                ? "Explore your concept map and revisit lessons."
                : "Choose a topic and grow your understanding, one concept at a time."}
          </p>
          {current ? (
            <a className="button light" href={url("map", current.id)}>
              View full tree
            </a>
          ) : (
            <CreateTreeAction />
          )}
        </div>
      </section>
      {current && (
        <section className="dashboard-map">
          <p>
            {done(current)} of {current.nodes.length} concepts completed
          </p>
          <ConceptMap tree={current} compact />
        </section>
      )}
      <Experience xp={xp} />
      <div className="metrics">
        {metrics.map(([icon, value, label, color]) => (
          <div className="panel metric" key={label}>
            <span className={"round " + color}>
              <Icon name={icon} />
            </span>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section>
          <div className="section-head">
            <h2>My learning trees</h2>
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
            <span className="round gold">
              <Icon name="compass" />
            </span>
            <small>NEXT STEP</small>
            <h3>{next?.title || "Choose a concept"}</h3>
            <p>
              {next?.description ||
                "Open a learning tree to explore its lessons."}
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
      <PageTitle label="LIBRARY" title="My learning trees">
        <CreateTreeAction />
      </PageTitle>
      <input
        className="search"
        aria-label="Search trees"
        placeholder="Search learning trees…"
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
      <PageTitle label="PROGRESS" title="Learning analytics" />
      <label>
        Learning tree
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
  const attempts = trees.flatMap((t) => t.history);
  const awards = [
    [
      "First steps",
      "Complete your first assessment.",
      attempts.length > 0,
      "achievements/first-steps",
    ],
    [
      "On track",
      "Pass a quiz with a score of 75% or higher.",
      attempts.some((q) => q.score >= 0.75),
      "achievements/on-track",
    ],
    [
      "Perfect recall",
      "Answer every question correctly in a quiz.",
      attempts.some((q) => q.score === 1),
      "achievements/perfect-recall",
    ],
    [
      "Branch explorer",
      "Complete an optional follow-up concept.",
      trees.some((t) =>
        t.nodes.some((n) => n.kind === "optional" && n.status === "mastered"),
      ),
      "achievements/branch-explorer",
    ],
    [
      "Back on track",
      "Complete a required review concept.",
      trees.some((t) =>
        t.nodes.some((n) => n.kind === "required" && n.status === "mastered"),
      ),
      "achievements/back-on-track",
    ],
    [
      "Tree complete",
      "Finish all core concepts in one learning tree.",
      trees.some((t) => {
        const core = t.nodes.filter((n) => n.kind === "core");
        return core.length > 0 && core.every((n) => n.status === "mastered");
      }),
      "achievements/tree-complete",
    ],
  ];
  return (
    <>
      <PageTitle label="PROGRESS" title="Achievements" />
      <Experience xp={xp} />
      <p>{awards.filter((a) => a[2]).length} of 6 milestones earned</p>
      <div className="cards">
        {awards.map(([name, desc, earned, icon]) => (
          <article className="panel pad award" key={name}>
            <span className={"round " + (earned ? "gold" : "muted")}>
              <Icon name={icon} />
            </span>
            <small>{earned ? "EARNED" : "LOCKED"}</small>
            <h2>{name}</h2>
            <p>{desc}</p>
          </article>
        ))}
      </div>
    </>
  );
}
