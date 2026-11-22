import React, { useEffect, useState } from "react";
export const percent = (value) => Math.round(value * 100) + "%";
export const done = (tree) =>
  tree.nodes.filter((n) => n.status === "mastered").length;
export const url = (...parts) => "#/" + parts.map(encodeURIComponent).join("/");
export const go = (...parts) => {
  location.hash = url(...parts);
};
export function useRoute() {
  const read = () =>
    location.hash
      .slice(2)
      .split("/")
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return "";
        }
      });
  const [route, set] = useState(read);
  useEffect(() => {
    const change = () => {
      set(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return route;
}
const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  trees: "M5 3h14v5H5z M3 12h18 M5 16h14 M7 20h10",
  map: "M5 4v15h14 M5 10h10 M15 7l4 3-4 3",
  analytics: "M3 20h18 M6 16v-5 M12 16V4 M18 16V8",
  achievements:
    "M6 3h12v5a6 6 0 0 1-12 0z M6 5H3v2a5 5 0 0 0 4 5 M18 5h3v2a5 5 0 0 1-4 5 M12 14v5 M8 21h8",
  book: "M12 6Q7 2 2 4v14q5-2 10 2 5-4 10-2V4q-5-2-10 2v14",
  target: "M20 12a8 8 0 1 1-8-8 M16 12a4 4 0 1 1-4-4 M12 12l8-8",
  leaf: "M4 19Q1 4 20 3q1 16-13 16 M5 20l9-10",
  compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M15 8l-2 6-5 2 2-6z",
  plus: "M12 5v14 M5 12h14",
  settings: "M3 7h18 M3 17h18 M8 4v6 M16 14v6",
  lock: "M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3",
  check: "m4 12 5 5L20 6",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  calendar: "M4 5h16v15H4z M4 10h16 M8 3v5 M16 3v5",
  chevron: "m9 5 7 7-7 7",
  bolt: "m14 2-9 12h6l-1 8 9-13h-6z",
};
export function Icon({ name, size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Notice({ children }) {
  return (
    <p className="notice" role="status">
      {children}
    </p>
  );
}
export function PageTitle({ label, title, children }) {
  return (
    <header className="page-title">
      <div>
        {label && <small>{label}</small>}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
export function CreateTreeAction() {
  return (
    <a className="button primary" href={url("create")}>
      <Icon name="plus" size={17} />
      Create tree
    </a>
  );
}

export function Experience({ xp }) {
  return (
    <section className="panel pad experience" aria-label="Experience points">
      <div>
        <span className="round gold">
          <Icon name="bolt" />
        </span>
        <div>
          <small>EXPERIENCE</small>
          <h2>Level {xp.level}</h2>
        </div>
        <strong>{xp.xp} total XP</strong>
      </div>
      <progress
        aria-label="Experience toward next level"
        value={xp.xp_current}
        max={xp.xp_max}
      />
      <span>
        {xp.xp_current} / {xp.xp_max} XP toward level {xp.level + 1}
      </span>
    </section>
  );
}
export function TreeCard({ tree, onDelete, removing }) {
  const completed = done(tree);
  return (
    <article className="panel tree-entry">
      <a className="tree-card" href={url("map", tree.id)}>
        <span className="iconbox">
          <Icon name="map" />
        </span>
        <div>
          <h3>{tree.title}</h3>
          <p>
            {tree.nodes.length} concepts · {completed} completed
          </p>
          <progress max={tree.nodes.length || 1} value={completed} />
        </div>
        <Icon name="chevron" />
      </a>
      <button
        className="delete-action"
        disabled={Boolean(removing)}
        aria-label={"Delete " + tree.title}
        onClick={() => onDelete(tree)}
      >
        {removing === tree.id ? "Deleting…" : "Delete"}
      </button>
    </article>
  );
}
export function SafeLink({ href, children }) {
  return /^https?:\/\//i.test(href || "") ? (
    <a href={href} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  ) : (
    <span>{children}</span>
  );
}
