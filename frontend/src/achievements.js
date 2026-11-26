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
const submitted = (quiz) => new Date(quiz.submit_time.replace(" ", "T") + "Z");
// quiz scores (0 to 1) in the order the quizzes were taken
const scores = (quizzes) =>
  [...quizzes]
    .sort((a, b) => a.submit_time.localeCompare(b.submit_time))
    .map((q) => q.score);
// longest run of quizzes in a row whose score passes check(score)
const inARow = (quizzes, check) => {
  let best = 0,
    run = 0;
  scores(quizzes).forEach((score) => {
    run = check(score) ? run + 1 : 0;
    best = Math.max(best, run);
  });
  return best;
};
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
// most quizzes finished on any one day
const busiestDay = (quizzes) => {
  const count = {};
  quizzes.forEach((q) => {
    const day = dayNumber(submitted(q));
    count[day] = (count[day] || 0) + 1;
  });
  return Math.max(0, ...Object.values(count));
};
// all of a tree's core concepts finished within x hours of its first quiz
const finishedWithin = (tree, hours) => {
  if (!coreDone(tree)) return false;
  const core = new Set(tree.nodes.filter((n) => n.kind === "core").map((n) => n.id));
  const coreTimes = tree.history
    .filter((q) => core.has(q.node_id))
    .map((q) => submitted(q).getTime());
  if (!coreTimes.length) return false;
  const first = Math.min(...tree.history.map((q) => submitted(q).getTime()));
  return Math.max(...coreTimes) - first <= hours * 36e5; // 36e5 ms = 1 hour
};

// every achievement with .unlocked, in display order: earned ones first (latest unlocked
// first), then the locked ones in the order of the list below. data = { trees, xp, stats }
export function achievementList({ trees, xp, stats }) {
  const quizzes = trees.flatMap((t) => t.history);
  const times = stats?.achievements || {};
  const now = new Date().toISOString().replace("T", " "); // just earned, not saved yet
  return ACHIEVEMENTS.map((a, position) => {
    const unlocked = a.earned({ trees, quizzes, xp, stats });
    return { ...a, position, unlocked, unlockedAt: unlocked ? times[a.id] || now : "" };
  }).sort(
    (a, b) =>
      b.unlocked - a.unlocked ||
      b.unlockedAt.localeCompare(a.unlockedAt) ||
      a.position - b.position, // same time (or both locked): keep the list's order
  );
}

export const ACHIEVEMENTS = [
  {
    id: "finally-awake",
    name: "Finally Awake",
    description: "Complete your first assessment.",
    earned: ({ quizzes }) => quizzes.length > 0,
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
    id: "keeper-of-the-forest",
    name: "Keeper of the Forest",
    description: "Create 10 skill trees",
    earned: ({ trees }) => trees.length >= 10
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
    id: "arborist",
    name: "Arborist",
    description: "Finish all core concepts in one skill tree.",
    earned: ({ trees }) => trees.some(coreDone),
  },
  {
    id: "completionist",
    name: "Completionist",
    description: "Master every concept in a skill tree, including optional ones.",
    earned: ({ trees }) =>
      trees.some((t) => t.nodes.length > 0 && t.nodes.every((n) => n.status === "mastered")),
  },
  {
    id: "speedrun",
    name: "Speedrun",
    description: "Finish all core concepts of a skill tree within 1 hour.",
    earned: ({ trees }) => trees.some((t) => finishedWithin(t, 1)),
  },
  {
    id: "polymath",
    name: "Polymath",
    description: "Master a concept in 10 different skill trees.",
    earned: ({ trees }) =>
      trees.filter((t) => t.nodes.some((n) => n.status === "mastered")).length >= 10,
  },
  {
    id: "abecedarian",
    name: "Abecedarian",
    description: "Have skill trees starting with each letter of the alphabet.",
    earned: ({ trees }) => {
      const letters = new Set(trees.map((t) => t.title.trim()[0]?.toUpperCase())); // Trim title to just first letter
      return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", 
        "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"].every((letter) => letters.has(letter));
    },
  },
  {
    id: "one-trick",
    name: "One-Trick",
    description: "Have 3 skill trees that share a word in their titles.",
    earned: ({ trees }) => {
      const small = new Set(["a", "an", "and", "the", "of", "in", "on", "to", "for", "with"]);
      const count = {}; // word -> how many tree titles contain it
      trees.forEach((t) => {
        const words = new Set(t.title.toLowerCase().match(/[a-z0-9]+/g));
        words.forEach((word) => {
          if (!small.has(word)) count[word] = (count[word] || 0) + 1;
        });
      });
      return Object.values(count).some((n) => n >= 3);
    },
  },
  {
    id: "assemble",
    name: "Assemble",
    description: "Master a concept that has 3 or more prerequisites.",
    earned: ({ trees }) =>
      trees.some((t) =>
        t.nodes.some(
          (n) =>
            n.status === "mastered" &&
            t.edges.filter((e) => e.child_id === n.id).length >= 3,
        ),
      ),
  },
  {
    id: "grow-up",
    name: "Grow Up",
    description: "Get exactly 67% on a quiz.",
    earned: ({ quizzes }) => scores(quizzes).some((score) => score === 1),
  },
  {
    id: "total-recall",
    name: "Total Recall",
    description: "Pass a quiz with a score of 100%.",
    earned: ({ quizzes }) => scores(quizzes).some((score) => score === 1),
  },
  {
    id: "honours-student",
    name: "Honours Student",
    description: "Score 100% on at least 8 different quizzes.",
    earned: ({ quizzes }) => scores(quizzes).filter((score) => score === 1).length >= 8,
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
    id: "end-on-win",
    name: "Can't End on a Win",
    description: "Pass 10 quizzes in a row.",
    earned: ({ quizzes }) => inARow(quizzes, (score) => score >= 0.75) >= 10,
  },
  {
    id: "end-on-loss",
    name: "Can't End on a Loss",
    description: "Fail 3 quizzes in a row.",
    earned: ({ quizzes }) => inARow(quizzes, (score) => score < 0.75) >= 3,
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Finish a quiz between midnight and 4AM",
    earned: ({ quizzes }) => quizzes.some((q) => submitted(q).getHours() < 4),
  },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Finish a quiz between 4AM and 8AM",
    earned: ({ quizzes }) =>
      quizzes.some((q) => {const hour = submitted(q).getHours();
                          return hour >= 4 && hour < 8;
      }),
  },
  {
    id: "daily-grindset",
    name: "Daily Grindset",
    description: "Take a quiz on 7 days in a row.",
    earned: ({ quizzes }) => longestStreak(quizzes) >= 7,
  },
  {
    id: "tried-and-tested",
    name: "Tried and Tested",
    description: "Finish 100 quizzes.",
    earned: ({ quizzes }) => quizzes.length >= 100,
  },
  {
    id: "burnout",
    name: "Burnout",
    description: "Finish 10 quizzes in one day.",
    earned: ({ quizzes }) => busiestDay(quizzes) >= 10,
  },
  {
    id: "never-stop",
    name: "Never Stop Never Stopping",
    description: "Take a quiz on both Saturday and Sunday of the same weekend.",
    earned: ({ quizzes }) => {
      const days = new Set(quizzes.map((q) => dayNumber(submitted(q))));
      return quizzes.some((q) => {
        const date = submitted(q);
        return date.getDay() === 6 && days.has(dayNumber(date) + 1); // Saturday, then Sunday
      });
    },
  },
  {
    id: "meticulous",
    name: "Meticulous",
    description: "Open 25 different lesson sources.",
    earned: ({ stats }) => (stats?.sources_opened ?? 0) >= 25,
  },
  {
    id: "clear-rivers",
    name: "Clear Rivers",
    description: "Reach level 25.",
    earned: ({ xp }) => (xp?.level ?? 1) >= 25,
  },
  {
    id: "precog",
    name: "Precog",
    description: "Reach level 50.",
    earned: ({ xp }) => (xp?.level ?? 1) >= 50,
  },
  {
    id: "omniscient",
    name: "Omniscient",
    description: "Reach level 100.",
    earned: ({ xp }) => (xp?.level ?? 1) >= 100,
  },
];
