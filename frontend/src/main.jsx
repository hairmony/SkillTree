import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { loadWorkspace, request, treePath } from "./api";
import { Icon, Notice, go, url, useRoute } from "./ui";
import { Dashboard, Trees, Analytics, Achievements } from "./pages/Overview";
import { Lesson, LearningMap } from "./pages/Learning";
import CreateTree from "./pages/CreateTree";
import { Assessment, Results } from "./pages/Assessment";
import { Avatar, Profile, ProfileMenu } from "./pages/Profile";
import { useTreeJob } from "./useTreeJob";
import "./style.css";

const primaryNav = [
  ["dashboard", "Dashboard"],
  ["trees", "My trees"],
  ["analytics", "Analytics"],
  ["achievements", "Achievements"],
];
function App() {
  const [page = "dashboard", id, nodeId] = useRoute(),
    [trees, setTrees] = useState([]),
    [connectionError, setConnectionError] = useState(""),
    [xp, setXp] = useState(null),
    [feedback, setFeedback] = useState(""),
    [removing, setRemoving] = useState(null),
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
    if (result.xp) setXp(result.xp);
    go("results", treeId, nodeId);
    refresh().catch(() => {});
  }
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++revision.current;
    try {
      const [data, totals] = await Promise.all([
        loadWorkspace(),
        request("/xp"),
      ]);
      if (version !== revision.current) return;
      setTrees(data);
      setXp(totals);
      setConnectionError("");
    } catch (error) {
      if (version === revision.current) setConnectionError(error.message);
      throw error;
    } finally {
      if (version === revision.current) setLoading(false);
    }
  }, []);
  const job = useTreeJob(refresh);
  async function deleteTree(tree) {
    if (
      removing ||
      !window.confirm(
        `Delete “${tree.title}” and its lessons and quiz history? This cannot be undone.`,
      )
    )
      return;
    setRemoving(tree.id);
    try {
      await request(treePath(tree.id), undefined, "DELETE");
      ++revision.current;
      setTrees((previous) => previous.filter((item) => item.id !== tree.id));
      if (localStorage.getItem("recentTree") === tree.id)
        localStorage.removeItem("recentTree");
      if (evaluation?.treeId === tree.id) setEvaluation(null);
      if (job.status?.id === tree.id) job.dismiss();
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith("quiz:" + tree.id + ":"))
          sessionStorage.removeItem(key);
      }
      setFeedback(`Deleted “${tree.title}”.`);
      await refresh().catch(() => {});
    } catch (error) {
      setFeedback(`Could not delete “${tree.title}”. ${error.message}`);
    } finally {
      setRemoving(null);
    }
  }
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => {
    setMenu(false);
    if (trees.some((t) => t.id === id)) localStorage.setItem("recentTree", id);
  }, [page, id, nodeId, trees]);
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
  else if (connectionError)
    body = (
      <Notice>
        Cannot load your learning workspace. {connectionError}{" "}
        <button
          onClick={() => {
            setLoading(true);
            refresh().catch(() => {});
          }}
        >
          Retry Connection
        </button>
      </Notice>
    );
  else if (section === "dashboard")
    body = (
      <Dashboard
        trees={trees}
        xp={xp}
        onDelete={deleteTree}
        removing={removing}
      />
    );
  else if (section === "trees")
    body = <Trees trees={trees} onDelete={deleteTree} removing={removing} />;
  else if (section === "analytics") body = <Analytics trees={trees} />;
  else if (section === "achievements")
    body = <Achievements trees={trees} xp={xp} />;
  else if (section === "profile" || section === "settings")
    body = (
      <Profile
        xp={xp}
        name={name}
        saveName={saveName}
        editing={section === "settings"}
      />
    );
  else if (section === "create") body = <CreateTree job={job} />;
  else if (section === "map" && tree)
    body = (
      <LearningMap
        tree={tree}
        added={
          tree.history.find((q) => String(q.quiz_id) === nodeId)?.added_nodes ??
          (evaluation?.treeId === id ? evaluation.added?.map((n) => n.id) : [])
        }
      />
    );
  else if (section === "lesson" && node && node.status !== "locked")
    body = <Lesson tree={tree} node={node} />;
  else if (section === "quiz" && node?.status === "unlocked")
    body = <Assessment tree={tree} node={node} applyGrade={applyGrade} />;
  else if (section === "results" && node)
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
          {job.status && (
            <Notice>
              {job.status.state === "done"
                ? "Your learning tree is ready. "
                : ""}
              {job.status.message}{" "}
              {job.status.state === "done" && (
                <a href={url("map", job.status.id)} onClick={job.dismiss}>
                  Open Tree
                </a>
              )}
              {job.status.state === "paused" && (
                <button onClick={job.retry}>Check again</button>
              )}
              {job.status.state === "failed" && (
                <a href={url("create")}>Create tree</a>
              )}
              {!job.busy && <button onClick={job.dismiss}>Dismiss</button>}
            </Notice>
          )}
          {feedback && (
            <Notice>
              {feedback}{" "}
              <button onClick={() => setFeedback("")}>Dismiss</button>
            </Notice>
          )}
          {body}
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
