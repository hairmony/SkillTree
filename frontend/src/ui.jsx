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
// Every icon is its own file in frontend/assets/<name>.svg (24x24, stroke="currentColor").
// Vite loads them as text at build time; <Icon> keeps the outer <svg> (size, colour)
// and fills in the drawing from the file, so icons still take their colour from CSS.
const files = import.meta.glob("../assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});
const icons = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [
    path.match(/([^/]+)\.svg$/)[1],
    svg.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, ""), // just the drawing inside <svg>
  ]),
);
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
      dangerouslySetInnerHTML={{ __html: icons[name] || "" }}
    />
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
        title={removing === tree.id ? "Deleting…" : "Delete tree"}
        onClick={() => onDelete(tree)}
      >
        <Icon name="trash" size={28} />
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
