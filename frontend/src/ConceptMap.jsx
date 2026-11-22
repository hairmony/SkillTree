import React, {
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import dagre from "@dagrejs/dagre";
import { go, Notice } from "./ui";

const labels = {
  locked: "Locked",
  unlocked: "Available",
  mastered: "Completed",
};

// dagre lays the graph out top to bottom
function layoutGraph(tree, sizes, compact) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: compact ? 16 : 24, // space between cards in a row
    ranksep: compact ? 36 : 52, // space between rows
    marginx: compact ? 16 : 24,
    marginy: compact ? 16 : 24,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of tree.nodes) g.setNode(node.id, sizes[node.id]);
  for (const e of tree.edges) g.setEdge(e.parent_id, e.child_id);
  dagre.layout(g);

  const nodes = {};
  for (const node of tree.nodes) {
    const { x, y, width, height } = g.node(node.id); // x, y = card centre
    nodes[node.id] = { left: x - width / 2, top: y - height / 2 };
  }
  const edges = tree.edges.map((e) => edgePath(g.edge(e.parent_id, e.child_id).points));
  const { width, height } = g.graph();
  return { nodes, edges, width, height };
}

// Smooth the edges AND keep the bit stretch straight so arrow lines up
function edgePath(points) {
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      next = points[i + 1];
    d += ` Q${p.x} ${p.y} ${(p.x + next.x) / 2} ${(p.y + next.y) / 2}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last.x} ${last.y}`;
}

export default function ConceptMap({
  tree,
  compact = false,
  current,
  added = [],
}) {
  const graph = useRef(null);
  const viewport = useRef(null);
  const marker = useId().replace(/:/g, "");
  const [layout, setLayout] = useState(null);
  const [locked, setLocked] = useState(null);

  useLayoutEffect(() => {
    const canvas = graph.current;
    if (!canvas) return;
    const buttons = Array.from(canvas.querySelectorAll("[data-node]"));
    const view = viewport.current;
    let centered = false;
    // Measure the cards (titles wrap, so heights differ), then lay the graph out.
    function update() {
      const sizes = {};
      for (const el of buttons)
        sizes[el.dataset.node] = { width: el.offsetWidth, height: el.offsetHeight };
      const next = layoutGraph(tree, sizes, compact);
      setLayout(next);
      const targetId = current || added[0] || tree.nodes[0]?.id;
      const target = next.nodes[targetId];
      const el = targetId && canvas.querySelector(`[data-node="${CSS.escape(targetId)}"]`);
      if (!centered && target && el && view.clientWidth && view.clientHeight) {
        const offset = Math.max(0, (view.clientWidth - next.width) / 2); // graph is centred
        view.scrollLeft =
          offset + target.left - (view.clientWidth - el.offsetWidth) / 2;
        view.scrollTop = Math.max(0, target.top - view.clientHeight / 3);
        centered = true;
      }
    }
    const observer = new ResizeObserver(update);
    buttons.forEach((el) => observer.observe(el));
    update();
    return () => observer.disconnect();
  }, [tree, current, added[0], compact]);

  if (!tree.nodes.length) return <Notice>No concepts are available yet.</Notice>;
  const prerequisites = tree.edges
    .filter((edge) => edge.child_id === locked?.id)
    .map((edge) => tree.nodes.find((node) => node.id === edge.parent_id));
  return (
    <>
      <div
        className={"panel graph-scroll" + (compact ? " compact" : "")}
        ref={viewport}
        aria-label="Concept prerequisite map"
      >
        <div
          className="concept-graph"
          ref={graph}
          style={
            layout
              ? { width: layout.width, height: layout.height }
              : { visibility: "hidden" } // first pass: measuring the cards
          }
        >
          <svg aria-hidden="true">
            <defs>
              <marker
                id={marker}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8Z" fill="#94ba9b" />
              </marker>
            </defs>
            {layout?.edges.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#94ba9b"
                strokeWidth="2"
                markerEnd={`url(#${marker})`}
              />
            ))}
          </svg>
          {tree.nodes.map((node) => (
            <button
              key={node.id}
              data-node={node.id}
              aria-current={current === node.id ? "step" : undefined}
              className={`concept-node ${node.status} ${added.includes(node.id) ? "new-concept" : ""}`}
              style={layout?.nodes[node.id]}
              onClick={() =>
                node.status === "locked"
                  ? setLocked(node)
                  : go("lesson", tree.id, node.id)
              }
            >
              <b>{node.title}</b>
              <span>
                {labels[node.status]}
                {current === node.id && " · Current lesson"}
                {added.includes(node.id) && " · New"}
              </span>
            </button>
          ))}
        </div>
      </div>
      {locked && (
        <Notice>
          <b>{locked.title}</b> is locked. Complete these prerequisites first:{" "}
          {prerequisites
            .filter((n) => n.status !== "mastered")
            .map((n) => n.title)
            .join(", ")}
          .
        </Notice>
      )}
    </>
  );
}
