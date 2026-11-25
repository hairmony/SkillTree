import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { loadWorkspace, request, treePath } from "./api";
import { Icon, Notice, go, navSection, url, useRoute } from "./ui";
import { Dashboard, Trees, Analytics, Achievements } from "./pages/Overview";
import { Lesson, LearningMap } from "./pages/Learning";
import CreateTree from "./pages/CreateTree";
import { Assessment, Results } from "./pages/Assessment";
import { Avatar, Profile, ProfileMenu } from "./pages/Profile";
import { useTreeJob } from "./useTreeJob";
import appIconUrl from "../assets/app_icon.svg";
import "./style.css";
import { LABELS, TITLES } from "./labels";
import { achievementList } from "./achievements";

const primaryNav = Object.entries(TITLES.TAB_TITLES); // [key, sidebar label]
document.title = TITLES.APP; // browser tab
function App() {
  const [page = "dashboard", id, nodeId] = useRoute(),
    [trees, setTrees] = useState([]),
    [connectionError, setConnectionError] = useState(""),
    [xp, setXp] = useState(null),
    [feedback, setFeedback] = useState(""),
    [removing, setRemoving] = useState(null),
    [loading, setLoading] = useState(true),
    [menu, setMenu] = useState(false),
    // desktop: sidebar closed with the ☰ button (remembered); phones use `menu` instead
    [collapsed, setCollapsed] = useState(() => {
      try {
        return localStorage.getItem("sidebarCollapsed") === "1";
      } catch {
        return false;
      }
    });
  const isPhone = () => window.matchMedia("(max-width: 800px)").matches;
  function toggleNav() {
    if (isPhone()) return setMenu(!menu); // slide-out menu
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("sidebarCollapsed", collapsed ? "0" : "1");
    } catch {}
  }
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
  // save when each achievement is first earned (Achievements tab lists latest first)
  useEffect(() => {
    if (loading || connectionError || !xp) return;
    request("/stats")
      .then((stats) => {
        const fresh = achievementList({ trees, xp, stats })
          .filter((a) => a.unlocked && !(a.id in stats.achievements))
          .map((a) => a.id);
        if (fresh.length) return request("/achievements/unlocked", { ids: fresh });
      })
      .catch(() => {});
  }, [trees, xp, loading, connectionError]);
  useEffect(() => {
    setMenu(false);
    if (trees.some((t) => t.id === id)) localStorage.setItem("recentTree", id);
  }, [page, id, nodeId, trees]);
  const section = page || "dashboard",
    tree = trees.find((t) => t.id === id),
    node = tree?.nodes.find((n) => n.id === nodeId);
  const nav = navSection(section);
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
          {LABELS.RETRY_CONNECTION}
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
        <a href={tree ? url("map", id) : url("trees")}>Open skill trees</a>
      </Notice>
    );
  return (
    <div className={"app" + (collapsed ? " sidebar-collapsed" : "")}>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        {/* closes the sidebar; same height and place as the topbar ☰, so it doesn't jump */}
        <div className="brand-row">
          <button
            className="hamburger sidebar-close"
            aria-label="Collapse sidebar"
            onClick={toggleNav}
          >
            <Icon name="menu" />
          </button>
        </div>
        <div className="nav-title">{TITLES.WORKSPACE.toUpperCase()}</div>
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
          <ProfileMenu name={name} route={section} xp={xp} />
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
            aria-expanded={isPhone() ? menu : !collapsed}
            onClick={toggleNav}
          >
            <Icon name="menu" />
          </button>
          <a className="brand" href={url("dashboard")}>
            <img src={appIconUrl} alt="" />
            <span className="brand-name">SkillTree.</span>
          </a>
          <span>{TITLES.WORKSPACE}</span>
          <Icon name="chevron_right" />
          <b>{TITLES.TOPBAR[section] || TITLES.TOPBAR.missing}</b>
          <a className="header-profile" href={url("profile")}>
            <Avatar name={name} />
            <b>{name}</b>
          </a>
        </div>
        <div className="content" key={[section, id, nodeId].join("/")}>
          {job.status && (
            <Notice>
              {job.status.state === "done"
                ? "Your skill tree is ready. "
                : ""}
              {job.status.message}{" "}
              {job.status.state === "done" && (
                <a href={url("map", job.status.id)} onClick={job.dismiss}>
                  Open Tree
                </a>
              )}
              {job.status.state === "paused" && (
                <button onClick={job.retry}>{LABELS.CHECK_AGAIN}</button>
              )}
              {job.status.state === "failed" && (
                <a href={url("create")}>{LABELS.CREATE_TREE}</a>
              )}
              {!job.busy && <button onClick={job.dismiss}>{LABELS.DISMISS}</button>}
            </Notice>
          )}
          {feedback && (
            <Notice>
              {feedback}{" "}
              <button onClick={() => setFeedback("")}>{LABELS.DISMISS}</button>
            </Notice>
          )}
          {body}
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
