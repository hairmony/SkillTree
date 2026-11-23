import React, { useEffect, useState } from "react";
import { LABELS, TITLES } from "./labels";
export const percent = (value) => Math.round(value * 100) + "%";
export const done = (tree) =>
  tree.nodes.filter((n) => n.status === "mastered").length;
export const url = (...parts) => "#/" + parts.map(encodeURIComponent).join("/");
export const go = (...parts) => {
  location.hash = url(...parts);
};
// Which sidebar tab a page belongs to: pages for working on a tree count as the trees tab.
export const navSection = (page) =>
  ["map", "lesson", "quiz", "results", "create"].includes(page)
    ? "trees"
    : page || "dashboard";
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
// Every icon is its own file in frontend/assets/<name>.svg. Use currentColor for its
// colours so it follows the CSS. Any style works (outline or filled, any viewBox, e.g.
// Material Symbols): <Icon> keeps the file's own <svg> settings and only sets the size.
// Sub-folders work too: assets/achievements/on-track.svg is <Icon name="achievements/on-track" />.
// (assets/background/ is skipped: those are big images used from CSS, not icons)
const files = import.meta.glob(["../assets/**/*.svg", "!../assets/background/**"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const icons = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => {
    const tag = svg.match(/<svg([^>]*)>/)?.[1] || "";
    const attrs = {};
    for (const [, key, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g))
      if (!["xmlns", "width", "height", "class", "style"].includes(key))
        attrs[camel(key)] = value; // e.g. stroke-width -> strokeWidth for React
    return [
      path.replace(/^\.\.\/assets\//, "").replace(/\.svg$/, ""), // e.g. "achievements/on-track"
      { attrs, inner: svg.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, "") },
    ];
  }),
);
export function Icon({ name, size = 28 }) {
  const icon = icons[name];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...icon?.attrs}
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: icon?.inner || "" }}
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
// The small label above the heading is the sidebar tab this page belongs to
// (TITLES.TAB_TITLES), so it always matches the sidebar. Pages with no tab (profile) show none.
export function PageTitle({ title, children }) {
  const label = TITLES.TAB_TITLES[navSection(location.hash.slice(2).split("/")[0])];
  return (
    <header className="page-title">
      <div>
        {label && <small>{label.toUpperCase()}</small>}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
export function CreateTreeAction() {
  return (
    <a className="button primary" href={url("create")}>
      <Icon name="add" />
      {LABELS.CREATE_TREE}
    </a>
  );
}

// XP icon colour by level: blends smoothly between these, level 1 → level 50 (and beyond).
const LEVEL_COLOURS = [
  [1, "#9ccf8a"], // green
  [12, "#6fc7c4"], // teal
  [25, "#7aa8f0"], // blue
  [38, "#b78af0"], // purple
  [50, "#e6c982"], // gold
];
export function levelColour(level) {
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  for (let i = 1; i < LEVEL_COLOURS.length; i++) {
    const [l1, c1] = LEVEL_COLOURS[i - 1],
      [l2, c2] = LEVEL_COLOURS[i];
    if (level <= l2) {
      const t = Math.max(0, (level - l1) / (l2 - l1));
      const [a, b] = [hex(c1), hex(c2)];
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(",")})`;
    }
  }
  return LEVEL_COLOURS[LEVEL_COLOURS.length - 1][1];
}
export function Experience({ xp }) {
  return (
    <section className="panel pad experience" aria-label="Experience points">
      <small>EXPERIENCE</small>
      <div className="experience-row">
        <span className="experience-icon" style={{ color: levelColour(xp.level) }}>
          <Icon name="bolt" />
        </span>
        <h2>Level {xp.level}</h2>
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
          <Icon name="map" size={36} />
        </span>
        <div>
          <h3>{tree.title}</h3>
          <p>
            {tree.nodes.length} concepts · {completed} completed
          </p>
          <progress max={tree.nodes.length || 1} value={completed} />
        </div>
        <Icon name="chevron_right" />
      </a>
      <button
        className="delete-action"
        disabled={Boolean(removing)}
        aria-label={"Delete " + tree.title}
        title={removing === tree.id ? "Deleting…" : "Delete tree"}
        onClick={() => onDelete(tree)}
      >
        <Icon name="trash" />
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
