import React, { useState } from "react";
import { PageTitle } from "../ui";
import { LABELS } from "../labels";
export default function CreateTree({ job }) {
  const [topic, setTopic] = useState(""),
    [goal, setGoal] = useState(""),
    [notes, setNotes] = useState("");
  function submit(event) {
    event.preventDefault();
    if (topic.trim())
      job.start({
        topic: topic.trim(),
        description: goal.trim(),
        text: notes.trim() || null,
      });
  }
  return (
    <>
      <PageTitle label="MY TREES" title="Create a learning tree" />
      <form className="panel pad form" onSubmit={submit}>
        <h2>What do you want to learn?</h2>
        <p>
          Choose a topic. Your tree will connect concepts with lessons, sources,
          and quizzes.
        </p>
        <label>
          Topic
          <input
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Neural networks"
          />
        </label>
        <label>
          Learning goal <em>optional</em>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What would you like to understand or build?"
          />
        </label>
        <details>
          <summary>Add reference text</summary>
          <label>
            Notes to include
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </details>
        <button className="primary" disabled={job.busy || !topic.trim()}>
          {job.busy ? LABELS.GENERATING_TREE : LABELS.GENERATE_TREE}
        </button>
      </form>
    </>
  );
}
