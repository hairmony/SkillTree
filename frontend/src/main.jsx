import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { loadWorkspace } from "./api";
import { Icon, Notice, go, url, useRoute } from "./ui";
import { Dashboard, Trees, Analytics, Achievements } from "./pages/Overview";
import { Lesson, LearningMap } from "./pages/Learning";
import CreateTree from "./pages/CreateTree";
import { Assessment, Results } from "./pages/Assessment";
import { Avatar, Profile, ProfileMenu } from "./pages/Profile";
import sample from "./sample.json";
import "./style.css";

const sampleTrees = [
  { id: "demo", title: "Linear Algebra", ...sample.tree, history: [] },
];
const primaryNav = [
  ["dashboard", "Dashboard"],
  ["trees", "My trees"],
  ["analytics", "Analytics"],
  ["achievements", "Achievements"],
];
function App() {
  const [page = "dashboard", id, nodeId] = useRoute(),
    [trees, setTrees] = useState(sampleTrees),
    [live, setLive] = useState(false),
    [loading, setLoading] = useState(true),
    [menu, setMenu] = useState(false);
  const [name, setName] = useState(
    () => localStorage.getItem("studentName") || "Student",
  );
  const [evaluation, setEvaluation] = useState(null);
  function saveName(value) {
    localStorage.setItem("studentName", value);
    setName(value);
  }
  function applyGrade(treeId, nodeId, result, questions) {
    setEvaluation({
      treeId,
      nodeId,
      ...result,
      results: result.results.map((answer) => ({
        ...questions.find((q) => q.id === answer.id),
        ...answer,
      })),
    });
    setTrees((previous) =>
      previous.map((tree) =>
        tree.id === treeId ? { ...tree, ...result.tree } : tree,
      ),
    );
    go("results", treeId, nodeId);
    loadWorkspace()
      .then(setTrees)
      .catch(() => {});
  }
  const refresh = useCallback(async () => {
    try {
      const data = await loadWorkspace();
      setTrees(data);
      setLive(true);
    } catch (e) {
      setTrees(sampleTrees);
      setLive(false);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => {
    setMenu(false);
    if (id) localStorage.setItem("recentTree", id);
  }, [page, id, nodeId]);
  const section = page || "dashboard",
    tree = trees.find((t) => t.id === id),
    node = tree?.nodes.find((n) => n.id === nodeId);
  const nav = ["map", "lesson", "quiz", "results", "create"].includes(section)
    ? "trees"
    : section;
  const titles = {
    dashboard: "Overview",
    trees: "My trees",
    map: "Learning map",
    lesson: "Lesson",
    quiz: "Assessment",
    results: "Answer review",
    analytics: "Analytics",
    achievements: "Achievements",
    create: "Create tree",
    profile: "My Profile",
    settings: "Settings",
  };
  let body;
  if (loading) body = <Notice>Opening your workspace…</Notice>;
  else if (section === "dashboard") body = <Dashboard trees={trees} />;
  else if (section === "trees") body = <Trees trees={trees} />;
  else if (section === "analytics") body = <Analytics trees={trees} />;
  else if (section === "achievements") body = <Achievements trees={trees} />;
  else if (section === "profile" || section === "settings")
    body = (
      <Profile
        name={name}
        saveName={saveName}
        editing={section === "settings"}
      />
    );
  else if (section === "create")
    body = <CreateTree live={live} refresh={refresh} />;
  else if (section === "map" && tree)
    body = <LearningMap tree={tree} live={live} />;
  else if (section === "lesson" && node && node.status !== "locked")
    body = <Lesson tree={tree} node={node} live={live} />;
  else if (section === "quiz" && node?.status === "unlocked")
    body = (
      <Assessment tree={tree} node={node} live={live} applyGrade={applyGrade} />
    );
  else if (section === "results" && live && node)
    body = (
      <Results
        tree={tree}
        node={node}
        evaluation={
          evaluation?.treeId === id && evaluation?.nodeId === nodeId
            ? evaluation
            : null
        }
      />
    );
  else
    body = (
      <Notice>
        This page is unavailable.{" "}
        <a href={tree ? url("map", id) : url("trees")}>Open learning trees</a>
      </Notice>
    );
  return (
    <div className="app">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a className="brand" href={url("dashboard")}>
          <img src="/mark.svg" alt="" />
          SkillTree
        </a>
        <div className="nav-title">WORKSPACE</div>
        <nav>
          {primaryNav.map(([key, title]) => (
            <a
              key={key}
              aria-current={nav === key ? "page" : undefined}
              className={nav === key ? "active" : ""}
              href={url(key)}
            >
              <Icon name={key} />
              {title}
            </a>
          ))}
        </nav>
        <div className="nav-footer">
          <ProfileMenu name={name} route={section} />
        </div>
      </aside>
      {menu && (
        <button
          aria-label="Close navigation"
          className="scrim"
          onClick={() => setMenu(false)}
        />
      )}
      <main>
        <div className="topbar">
          <button
            className="hamburger"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name="menu" />
          </button>
          <span>Workspace</span>
          <Icon name="chevron" size={14} />
          <b>{titles[section] || "Page"}</b>
          <a className="header-profile" href={url("profile")}>
            <Avatar name={name} />
            <b>{name}</b>
          </a>
        </div>
        <div className="content" key={[section, id, nodeId].join("/")}>
          {body}
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
