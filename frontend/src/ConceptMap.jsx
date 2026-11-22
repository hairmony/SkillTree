import React, {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { go, Notice } from "./ui";

const labels = {
  locked: "Locked",
  unlocked: "Available",
  mastered: "Completed",
};

function groupByDepth(tree) {
  const parents = new Map(tree.nodes.map((node) => [node.id, []]));
  for (const edge of tree.edges)
    parents.get(edge.child_id).push(edge.parent_id);
  const depths = new Map();
  function depth(id) {
    if (!depths.has(id)) {
      depths.set(
        id,
        Math.max(0, ...parents.get(id).map((parent) => depth(parent) + 1)),
      );
    }
    return depths.get(id);
  }
  const rows = [];
  for (const node of tree.nodes) (rows[depth(node.id)] ??= []).push(node);
  return rows;
}

export default function ConceptMap({
  tree,
  compact = false,
  current,
  added = [],
}) {
  const rows = useMemo(() => groupByDepth(tree), [tree]);
  const graph = useRef(null);
  const viewport = useRef(null);
  const marker = useId().replace(/:/g, "");
  const [paths, setPaths] = useState([]);
  const [locked, setLocked] = useState(null);

  useLayoutEffect(() => {
    const canvas = graph.current;
    if (!canvas) return;
    const buttons = Array.from(canvas.querySelectorAll("[data-node]"));
    const byId = new Map(buttons.map((el) => [el.dataset.node, el]));
    // Measure the wrapped titles so arrows always meet the actual card edges.
    function measure() {
      setPaths(
        tree.edges.map(({ parent_id, child_id }) => {
          const a = byId.get(parent_id),
            b = byId.get(child_id);
          const x = a.offsetLeft + a.offsetWidth / 2,
            y = a.offsetTop + a.offsetHeight;
          const endX = b.offsetLeft + b.offsetWidth / 2,
            endY = b.offsetTop - 3;
          if (Number(b.dataset.row) > Number(a.dataset.row) + 1) {
            const rowBottom = Math.max(
              ...Array.from(
                a.parentElement.children,
                (el) => el.offsetTop + el.offsetHeight,
              ),
            );
            return `M${x} ${y} V${rowBottom + 12} H8 V${endY - 15} H${endX} V${endY}`;
          }
          const mid = (y + endY) / 2;
          return `M${x} ${y} C${x} ${mid},${endX} ${mid},${endX} ${endY}`;
        }),
      );
    }
    const target = byId.get(current || added[0]) || buttons[0];
    const view = viewport.current;
    let centered = false;
    function updateLayout() {
      measure();
      if (!centered && target && view.clientWidth && view.clientHeight) {
        view.scrollLeft =
          target.offsetLeft - (view.clientWidth - target.offsetWidth) / 2;
        view.scrollTop = Math.max(0, target.offsetTop - view.clientHeight / 3);
        centered = true;
      }
    }
    const observer = new ResizeObserver(updateLayout);
    [view, canvas, ...buttons].forEach((el) => observer.observe(el));
    updateLayout();
    return () => observer.disconnect();
  }, [tree, current, added[0], compact]);

  if (!rows.length) return <Notice>No concepts are available yet.</Notice>;
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
        <div className="concept-graph" ref={graph}>
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
            {paths.map((d, i) => (
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
          {rows.map((row, index) => (
            <div className="concept-row" key={index}>
              {row.map((node) => (
                <button
                  key={node.id}
                  data-node={node.id}
                  data-row={index}
                  aria-current={current === node.id ? "step" : undefined}
                  className={`concept-node ${node.status} ${added.includes(node.id) ? "new-concept" : ""}`}
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
