const defaultBase = (import.meta.env.VITE_API_BASE || "/api").replace(
  /\/$/,
  "",
);
export const treePath = (id) => "/trees/" + encodeURIComponent(id);
export const nodePath = (id, node) =>
  treePath(id) + "/nodes/" + encodeURIComponent(node);

export async function request(
  path,
  body,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(
    (localStorage.getItem("apiBase") || defaultBase) + path,
    {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "The learning server is unavailable. Check the connection and try again.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail
          .map((item) => item.msg)
          .filter(Boolean)
          .join(" ")
      : data.detail;
    const error = new Error(
      detail || `Request failed (HTTP ${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function loadWorkspace() {
  const trees = await request("/trees");
  return Promise.all(
    // FastAPI seeds this reserved example on every startup.
    trees
      .filter((tree) => tree.id !== "demo")
      .map(async (tree) => {
        const [graph, history] = await Promise.all([
          request(treePath(tree.id)),
          request(treePath(tree.id) + "/quizzes"),
        ]);
        return { ...tree, ...graph, history };
      }),
  );
}
