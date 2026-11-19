import React, { useState } from "react";
import { nodePath } from "../api";
import { url } from "../ui";
import { ReadState, useRead } from "./Learning";

function MissedAnswers({ treeId, nodeId, concept }) {
  const { data, error, reload } = useRead(
    nodePath(treeId, nodeId) + "/quiz/results",
  );
  if (!data) return <ReadState error={error} reload={reload} />;
  const questions = data.results.filter(
    (q) => !q.correct && q.concept === concept,
  );
  return questions.map((q) => {
    const option = (id) => q.options.find((o) => o.id === id)?.text;
    return (
      <article className="missed-answer" key={q.id}>
        <h3>{q.text}</h3>
        <p>Your answer · {option(q.chosen)}</p>
        <p>Correct answer · {option(q.correct_option_id)}</p>
        {q.explanation && <p>{q.explanation}</p>}
      </article>
    );
  });
}

export default function KnowledgeGaps({ rows }) {
  const [open, setOpen] = useState(null);
  const groups = new Map();
  for (const quiz of rows) {
    const node = quiz.tree.nodes.find((n) => n.id === quiz.node_id);
    for (const concept of quiz.missed_concepts) {
      const key = JSON.stringify([quiz.tree.id, quiz.node_id, concept]);
      if (!groups.has(key))
        groups.set(key, {
          key,
          concept,
          tree: quiz.tree,
          node,
          quiz,
          count: 0,
        });
      groups.get(key).count++;
    }
  }
  return (
    <section className="panel pad">
      <h2>Knowledge gaps</h2>
      {!rows.length ? (
        <p>Complete a quiz to see which concepts need practice.</p>
      ) : !groups.size ? (
        <p>You answered every recorded question correctly.</p>
      ) : (
        [...groups.values()]
          .sort((a, b) => b.count - a.count)
          .map(({ key, concept, tree, node, count, quiz }, i) => {
            const review =
              tree.nodes.find(
                (n) =>
                  quiz.added_nodes.includes(n.id) &&
                  n.title.toLowerCase() === concept.toLowerCase() &&
                  n.status !== "locked",
              ) || node;
            const description =
              review?.description ||
              "No topic description is available for this assessment.";
            const expanded = key === open;
            const latest = tree.history.find((q) => q.node_id === quiz.node_id);
            return (
              <div className="gap" key={key}>
                <button
                  className="gap-trigger"
                  aria-expanded={expanded}
                  aria-controls={"gap-" + i}
                  aria-describedby={expanded ? undefined : "hint-" + i}
                  onClick={() => setOpen(expanded ? null : key)}
                >
                  <b>{concept}</b>
                  <span>
                    {count} missed {expanded ? "−" : "+"}
                  </span>
                </button>
                {!expanded && (
                  <div className="gap-tip" role="tooltip" id={"hint-" + i}>
                    {description}
                  </div>
                )}
                <div hidden={!expanded} id={"gap-" + i}>
                  {expanded && (
                    <div className="gap-detail">
                      <small>
                        {tree.title} · {node?.title || "Assessment"}
                      </small>
                      <h3>{concept}</h3>
                      <p>{description}</p>
                      <p>
                        {count}{" "}
                        {count === 1
                          ? "incorrect answer was"
                          : "incorrect answers were"}{" "}
                        recorded for this concept in this lesson.
                      </p>
                      {node && latest?.quiz_id === quiz.quiz_id && (
                        <MissedAnswers
                          treeId={tree.id}
                          nodeId={node.id}
                          concept={concept}
                        />
                      )}
                      {review && review.status !== "locked" ? (
                        <a
                          className="button primary"
                          href={url("lesson", tree.id, review.id)}
                        >
                          Review Topic
                        </a>
                      ) : (
                        <>
                          <p>The matching lesson is currently unavailable.</p>
                          <a href={url("map", tree.id)}>View learning tree</a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
      )}
    </section>
  );
}
