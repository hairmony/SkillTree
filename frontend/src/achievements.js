// Add achievement's here
// 1. add an entry (id, name, description, earned)
// 2. put its icon in frontend/assets/achievements/<id>.svg  (24x24, use currentColor)
//
// earned({ trees, quizzes, xp, stats }) returns true once it's unlocked:
//   trees   - every skill tree, with its nodes (each has .kind and .status) and edges
//   quizzes - every submitted quiz, each with .score (0 to 1)
//   xp      - { xp, level, xp_current, xp_max }
//   stats   - { sources_opened } from the backend's /stats (null while loading)

const coreDone = (tree) => {
  const core = tree.nodes.filter((n) => n.kind === "core");
  return core.length > 0 && core.every((n) => n.status === "mastered");
};
const finished = (trees, kind) =>
  trees.some((t) => t.nodes.some((n) => n.kind === kind && n.status === "mastered"));
// when a quiz was submitted, in the learner's own time zone (the backend stores UTC)
const submitted = (quiz) => new Date(quiz.submitted_at.replace(" ", "T") + "Z");
const dayNumber = (date) =>
  Math.round(new Date(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
// longest run of consecutive days with at least one quiz
const longestStreak = (quizzes) => {
  const days = [...new Set(quizzes.map((q) => dayNumber(submitted(q))))].sort((a, b) => a - b);
  let best = 0,
    run = 0;
  days.forEach((day, i) => {
    run = i > 0 && day === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
};
// how many levels below the top of its tree each concept sits (the basics concept is 0)
const levels = (tree) => {
  const parents = {};
  tree.edges.forEach((e) => (parents[e.child_id] ||= []).push(e.parent_id));
  const level = {};
  const of = (id) =>
    (level[id] ??= Math.max(-1, ...(parents[id] || []).map(of)) + 1);
  tree.nodes.forEach((n) => of(n.id));
  return level;
};

export const ACHIEVEMENTS = [
  {
    id: "finally-awake",
    name: "Finally Awake",
    description: "Complete your first assessment.",
    earned: ({ quizzes }) => quizzes.length > 0,
  },
  {
    id: "impressive",
    name: "Impressive!",
    description: "Pass a quiz with a score of 75% or higher.",
    earned: ({ quizzes }) => quizzes.some((q) => q.score >= 0.75),
  },
  {
    id: "total-recall",
    name: "Total Recall",
    description: "Answer every question correctly in a quiz.",
    earned: ({ quizzes }) => quizzes.some((q) => q.score === 1),
  },
  {
    id: "branch-manager",
    name: "Branch Manager",
    description: "Complete an optional follow-up concept.",
    earned: ({ trees }) => finished(trees, "optional"),
  },
  {
    id: "back-on-track",
    name: "Back on Track",
    description: "Complete a required review concept.",
    earned: ({ trees }) => finished(trees, "required"),
  },
  {
    id: "arborist",
    name: "Arborist",
    description: "Finish all core concepts in one skill tree.",
    earned: ({ trees }) => trees.some(coreDone),
  },
  {
    id: "polymath",
    name: "Polymath",
    description: "Reach level 25.",
    earned: ({ xp }) => (xp?.level ?? 1) >= 25,
  },
  {
    id: "omniscient",
    name: "Omniscient",
    description: "Reach level 50.",
    earned: ({ xp }) => (xp?.level ?? 1) >= 50,
  },
  {
    id: "keeper-of-the-forest",
    name: "Keeper of the Forest",
    description: "Create 10 skill trees.",
    earned: ({ trees }) => trees.length >= 10,
  },
  {
    id: "completionist",
    name: "Completionist",
    description: "Master every concept in a skill tree, including optional ones.",
    earned: ({ trees }) =>
      trees.some((t) => t.nodes.length > 0 && t.nodes.every((n) => n.status === "mastered")),
  },
  {
    id: "honours-student",
    name: "Honours Student",
    description: "Score 100% on at least 8 different quizzes.",
    earned: ({ quizzes }) => quizzes.filter((q) => q.score === 1).length >= 8,
  },
  {
    id: "well-read-redemption",
    name: "Well-Read Redemption",
    description: "Fail a quiz and score 100% on the review concept.",
    earned: ({ trees }) =>
      trees.some((t) =>
        t.history.some(
          (q) =>
            q.score === 1 && t.nodes.find((n) => n.id === q.node_id)?.kind === "required",
        ),
      ),
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Finish a quiz between midnight and 4 a.m.",
    earned: ({ quizzes }) => quizzes.some((q) => submitted(q).getHours() < 4),
  },
  {
    id: "daily-grindset",
    name: "Daily Grindset",
    description: "Take a quiz on 7 days in a row.",
    earned: ({ quizzes }) => longestStreak(quizzes) >= 7,
  },
  {
    id: "deep-roots",
    name: "Deep Roots",
    description: "Master a concept 4 or more levels deep in a skill tree.",
    earned: ({ trees }) =>
      trees.some((t) => {
        const level = levels(t);
        return t.nodes.some((n) => n.status === "mastered" && level[n.id] >= 4);
      }),
  },
  {
    id: "meticulous",
    name: "Meticulous",
    description: "Open 25 different lesson sources.",
    earned: ({ stats }) => (stats?.sources_opened ?? 0) >= 25,
  },
];
