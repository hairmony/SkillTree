// Walk backwards through prerequisites to find an available lesson on this branch.
export function nextLesson(tree, currentId) {
  const ready = tree.nodes.filter(
    (node) => node.id !== currentId && node.status === "unlocked",
  );
  const parents = new Map(tree.nodes.map((node) => [node.id, []]));
  for (const edge of tree.edges)
    parents.get(edge.child_id)?.push(edge.parent_id);
  const children = tree.edges
    .filter((edge) => edge.parent_id === currentId)
    .map((edge) => edge.child_id);
  const branch = new Set();
  function includeParents(id) {
    if (branch.has(id)) return;
    branch.add(id);
    for (const parent of parents.get(id) || []) includeParents(parent);
  }
  children.forEach(includeParents);
  return (
    ready.find((n) => n.kind === "required" && n.origin === currentId) ||
    ready.find((n) => n.kind === "required" && branch.has(n.id)) ||
    ready.find((n) => n.kind === "required") ||
    ready.find((n) => children.includes(n.id) && n.kind !== "optional") ||
    ready.find((n) => branch.has(n.id) && n.kind !== "optional") ||
    ready.find((n) => n.kind !== "optional") ||
    ready.find((n) => children.includes(n.id)) ||
    ready[0]
  );
}
