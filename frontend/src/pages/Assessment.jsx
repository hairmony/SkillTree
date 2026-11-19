import React, { useState } from "react";
import { request, nodePath, treePath } from "../api";
import { nextLesson } from "../learningPath";
import { done, Notice, PageTitle, percent, url } from "../ui";
import { ReadState, useRead } from "./Learning";
export function Assessment({ tree, node, live, applyGrade }) {
  const key = "quiz:" + tree.id + ":" + node.id;
  const [draft, setDraft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  });
  const [count, setCount] = useState(5),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function save(next) {
    setDraft(next);
    sessionStorage.setItem(key, JSON.stringify(next));
  }
  async function begin() {
    setBusy(true);
    setError("");
    try {
      const quiz = await request(
        nodePath(tree.id, node.id) + "/quiz?num_questions=" + count,
        {},
      );
      save({ quiz, answers: {} });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request(
        "/quizzes/" + draft.quiz.quiz_id + "/submit",
        { answers: draft.answers },
      );
      sessionStorage.removeItem(key);
      applyGrade(tree.id, node.id, result, draft.quiz.questions);
    } catch (e) {
      if (e.message === "quiz already submitted") {
        try {
          const history = await request(treePath(tree.id) + "/quizzes");
          if (
            history.find((q) => q.node_id === node.id)?.quiz_id ===
            draft.quiz.quiz_id
          ) {
            const [graded, graph] = await Promise.all([
              request(nodePath(tree.id, node.id) + "/quiz/results"),
              request(treePath(tree.id)),
            ]);
            sessionStorage.removeItem(key);
            applyGrade(
              tree.id,
              node.id,
              { ...graded, tree: graph },
              draft.quiz.questions,
            );
            return;
          }
        } catch {
          /* Keep the draft available until the saved result can be read. */
        }
      }
      setError(
        "We couldn’t confirm your submission. Your answers are saved in this tab. Try submitting again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a href={url("lesson", tree.id, node.id)}>‹ Back to lesson</a>
      <PageTitle label="ASSESSMENT" title={node.title} />
      {!draft ? (
        <div className="panel pad form">
          <h2>Check your understanding</h2>
          <p>
            Answer questions drawn from this lesson. Your results guide
            follow-up concepts.
          </p>
          <label>
            Number of questions
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={busy || !live} onClick={begin}>
            {busy ? "Preparing questions…" : "Begin quiz"}
          </button>
          {!live && (
            <Notice>Assessments are unavailable in the sample tree.</Notice>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
          <p>
            {Object.keys(draft.answers).length} of {draft.quiz.questions.length}{" "}
            answered
          </p>
          {draft.quiz.questions.map((q, index) => (
            <fieldset className="panel pad" key={q.id}>
              <legend>
                Question {index + 1} · {q.difficulty}
              </legend>
              <h3>{q.text}</h3>
              {q.options.map((o) => (
                <label className="answer" key={o.id}>
                  <input
                    type="radio"
                    name={String(q.id)}
                    value={o.id}
                    required
                    checked={draft.answers[q.id] === o.id}
                    onChange={() =>
                      save({
                        ...draft,
                        answers: { ...draft.answers, [q.id]: o.id },
                      })
                    }
                  />
                  {o.text}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            className="primary"
            disabled={
              busy ||
              !live ||
              Object.keys(draft.answers).length !== draft.quiz.questions.length
            }
          >
            {busy ? "Grading…" : "Submit assessment"}
          </button>
        </form>
      )}
      {error && (
        <Notice>
          {error} <a href={url("map", tree.id)}>Return to map</a>
        </Notice>
      )}
    </>
  );
}
export function Results({ tree, node, evaluation }) {
  const { data, error, reload } = useRead(
    nodePath(tree.id, node.id) + "/quiz/results",
    evaluation,
  );
  return (
    <>
      <a href={url("map", tree.id)}>‹ Learning map</a>
      <PageTitle label="ASSESSMENT REVIEW" title={node.title} />
      {!data ? (
        <ReadState error={error} reload={reload} />
      ) : (
        <>
          <section className="panel pad">
            <small>QUIZ SCORE</small>
            <h2 className="score">{percent(data.score)}</h2>
            <p>
              {data.results.filter((q) => q.correct).length} correct out of{" "}
              {data.results.length}
            </p>
            {data.added.map((n) => (
              <a className="row" key={n.id} href={url("lesson", tree.id, n.id)}>
                {n.title}
                <span>{n.kind} review</span>
              </a>
            ))}
            {typeof data.passed === "boolean" && (
              <p>
                {data.passed
                  ? "Passed"
                  : "Review recommended · Below passing score"}
              </p>
            )}
            {data.results.some((q) => !q.correct) && (
              <p>
                Knowledge gaps ·{" "}
                {[
                  ...new Set(
                    data.results
                      .filter((q) => !q.correct)
                      .map((q) => q.concept)
                      .filter(Boolean),
                  ),
                ].join(", ")}
              </p>
            )}
            {data.added_error && (
              <Notice>
                Follow-up concepts could not be added for this assessment.
              </Notice>
            )}
          </section>
          {data.results.map((q, i) => {
            const answer = (id) => q.options.find((o) => o.id === id)?.text;
            return (
              <article className="panel pad" key={q.id}>
                <small>
                  QUESTION {i + 1} · {q.correct ? "CORRECT" : "REVIEW"}
                </small>
                <h3>{q.text}</h3>
                <p>Your answer · {answer(q.chosen)}</p>
                {!q.correct && (
                  <p>Correct answer · {answer(q.correct_option_id)}</p>
                )}
                <p>{q.explanation}</p>
              </article>
            );
          })}
          <Continuation tree={tree} node={node} />
        </>
      )}
    </>
  );
}

function Continuation({ tree, node }) {
  const next = nextLesson(tree, node.id);
  return (
    <section className="panel pad">
      <h2>
        {next
          ? next.title
          : done(tree) === tree.nodes.length
            ? "Learning tree complete"
            : "No lesson is currently unlocked"}
      </h2>
      <p>
        {done(tree)} of {tree.nodes.length} concepts completed
        {next?.kind === "required" ? " · Required review" : ""}
      </p>
      {next ? (
        <a className="button primary" href={url("lesson", tree.id, next.id)}>
          Continue to Next Lesson
        </a>
      ) : (
        <a className="button primary" href={url("map", tree.id)}>
          Back to Learning Tree
        </a>
      )}
    </section>
  );
}
