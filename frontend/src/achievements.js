// Add achievement's here
// 1. add an entry (id, name, description, earned)
// 2. put its icon in frontend/assets/achievements/<id>.svg  (24x24, use currentColor)
//
// earned({ trees, quizzes, xp }) returns true once it's unlocked:
//   trees   - every skill tree, with its nodes (each has .kind and .status)
//   quizzes - every submitted quiz, each with .score (0 to 1)
//   xp      - { xp, level, xp_current, xp_max }

const coreDone = (tree) => {
  const core = tree.nodes.filter((n) => n.kind === "core");
  return core.length > 0 && core.every((n) => n.status === "mastered");
};
const finished = (trees, kind) =>
  trees.some((t) => t.nodes.some((n) => n.kind === kind && n.status === "mastered"));

export const ACHIEVEMENTS = [
  {
    id: "first-steps",
    name: "First steps",
    description: "Complete your first assessment.",
    earned: ({ quizzes }) => quizzes.length > 0,
  },
  {
    id: "on-track",
    name: "On track",
    description: "Pass a quiz with a score of 75% or higher.",
    earned: ({ quizzes }) => quizzes.some((q) => q.score >= 0.75),
  },
  {
    id: "perfect-recall",
    name: "Perfect recall",
    description: "Answer every question correctly in a quiz.",
    earned: ({ quizzes }) => quizzes.some((q) => q.score === 1),
  },
  {
    id: "branch-explorer",
    name: "Branch explorer",
    description: "Complete an optional follow-up concept.",
    earned: ({ trees }) => finished(trees, "optional"),
  },
  {
    id: "back-on-track",
    name: "Back on track",
    description: "Complete a required review concept.",
    earned: ({ trees }) => finished(trees, "required"),
  },
  {
    id: "tree-complete",
    name: "Tree complete",
    description: "Finish all core concepts in one skill tree.",
    earned: ({ trees }) => trees.some(coreDone),
  },
  {
    id: "halfway",
    name: "Halfway",
    description: "Reach level 25.",
    earned: ({ xp }) => (xp?.level ?? 1) >= 25,
  },
  {
    id: "mastered",
    name: "Mastered",
    description: "Reach level 50.",
    earned: ({ xp }) => (xp?.level ?? 1) >= 50,
  },
];
