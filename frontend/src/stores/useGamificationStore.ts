import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Achievement, GamificationState } from '@/types/app';

const ACHIEVEMENTS_DEFINITIONS: Omit<Achievement, 'unlockedAt'>[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first lesson',
    icon: 'footprints',
    requirement: { type: 'lessons_completed', count: 1 },
  },
  {
    id: 'knowledge_seeker',
    title: 'Knowledge Seeker',
    description: 'Complete 5 lessons',
    icon: 'book-open',
    requirement: { type: 'lessons_completed', count: 5 },
  },
  {
    id: 'scholar',
    title: 'Scholar',
    description: 'Complete 20 lessons',
    icon: 'graduation-cap',
    requirement: { type: 'lessons_completed', count: 20 },
  },
  {
    id: 'quiz_taker',
    title: 'Quiz Taker',
    description: 'Pass your first quiz',
    icon: 'check-circle',
    requirement: { type: 'quizzes_passed', count: 1 },
  },
  {
    id: 'quiz_champion',
    title: 'Quiz Champion',
    description: 'Pass 5 quizzes',
    icon: 'trophy',
    requirement: { type: 'quizzes_passed', count: 5 },
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Score 100% on a quiz',
    icon: 'star',
    requirement: { type: 'perfect_quiz', count: 1 },
  },
  {
    id: 'explorer',
    title: 'Knowledge Explorer',
    description: 'Start 3 different skill trees',
    icon: 'compass',
    requirement: { type: 'trees_started', count: 3 },
  },
  {
    id: 'path_master',
    title: 'Path Master',
    description: 'Complete an entire learning path',
    icon: 'award',
    requirement: { type: 'trees_completed', count: 1 },
  },
  {
    id: 'dedicated',
    title: 'Dedicated Learner',
    description: 'Maintain a 3-day learning streak',
    icon: 'flame',
    requirement: { type: 'streak_days', count: 3 },
  },
  {
    id: 'consistent',
    title: 'Consistency King',
    description: 'Maintain a 7-day learning streak',
    icon: 'zap',
    requirement: { type: 'streak_days', count: 7 },
  },
];

interface GamificationActions {
  addXP: (amount: number, reason: string) => void;
  recordLessonCompleted: (treeId?: string, nodeId?: string) => void;
  recordQuizPassed: (score: number, treeId?: string, nodeId?: string) => void;
  recordTreeStarted: () => void;
  recordTreeCompleted: () => void;
  updateStreak: () => void;
  resetGamification: () => void;
}

function checkAchievements(state: GamificationState): Achievement[] {
  return ACHIEVEMENTS_DEFINITIONS.map((def) => {
    const existing = state.achievements.find((a) => a.id === def.id);
    if (existing?.unlockedAt) return existing;

    let unlocked = false;
    switch (def.requirement.type) {
      case 'lessons_completed':
        unlocked = state.lessonsCompleted >= def.requirement.count;
        break;
      case 'quizzes_passed':
        unlocked = state.quizzesPassed >= def.requirement.count;
        break;
      case 'trees_started':
        unlocked = state.treesStarted >= def.requirement.count;
        break;
      case 'trees_completed':
        unlocked = state.treesCompleted >= def.requirement.count;
        break;
      case 'streak_days':
        unlocked = state.streakDays >= def.requirement.count;
        break;
      case 'perfect_quiz':
        unlocked = state.perfectQuizzes >= def.requirement.count;
        break;
    }

    return {
      ...def,
      unlockedAt: unlocked ? new Date().toISOString() : null,
    };
  });
}

/** Returns the local calendar day as YYYY-MM-DD */
export function getLocalCalendarDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Calculates difference in whole calendar days between two YYYY-MM-DD strings */
export function getDaysBetweenCalendarDates(date1Str: string, date2Str: string): number {
  const [y1, m1, d1] = date1Str.split('-').map(Number);
  const [y2, m2, d2] = date2Str.split('-').map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

const initialState: GamificationState = {
  xp: 0,
  level: 1,
  achievements: ACHIEVEMENTS_DEFINITIONS.map((d) => ({ ...d, unlockedAt: null })),
  streakDays: 0,
  lastActivityDate: null,
  lessonsCompleted: 0,
  quizzesPassed: 0,
  perfectQuizzes: 0,
  treesStarted: 0,
  treesCompleted: 0,
  completedConceptIds: [],
  passedQuizIds: [],
  version: 2,
};

export const useGamificationStore = create<GamificationState & GamificationActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      addXP: (amount: number, _reason: string) => {
        set((state) => {
          const newXP = state.xp + amount;
          const newLevel = Math.floor(newXP / 100) + 1;
          return { xp: newXP, level: newLevel };
        });
        get().updateStreak();
      },

      recordLessonCompleted: (treeId?: string, nodeId?: string) => {
        const state = get();
        const conceptKey = treeId && nodeId ? `${treeId}:${nodeId}` : null;
        const completedIds = state.completedConceptIds || [];

        // Prevent duplicate XP if already completed
        if (conceptKey && completedIds.includes(conceptKey)) {
          get().updateStreak();
          return;
        }

        const newCompleted = conceptKey ? [...completedIds, conceptKey] : completedIds;
        set((s) => {
          const updated = {
            ...s,
            lessonsCompleted: s.lessonsCompleted + 1,
            completedConceptIds: newCompleted,
          };
          return { ...updated, achievements: checkAchievements(updated) };
        });
        get().addXP(25, 'Lesson completed');
      },

      recordQuizPassed: (score: number, treeId?: string, nodeId?: string) => {
        const state = get();
        const quizKey = treeId && nodeId ? `${treeId}:${nodeId}` : null;
        const passedIds = state.passedQuizIds || [];

        // If quiz was already passed, do not reward duplicate base XP
        if (quizKey && passedIds.includes(quizKey)) {
          // If this is a new perfect score not previously achieved on this quiz
          if (score >= 1.0) {
            set((s) => {
              const updated = { ...s, perfectQuizzes: s.perfectQuizzes + 1 };
              return { ...updated, achievements: checkAchievements(updated) };
            });
          }
          get().updateStreak();
          return;
        }

        const newPassed = quizKey ? [...passedIds, quizKey] : passedIds;
        set((s) => {
          const updated = {
            ...s,
            quizzesPassed: s.quizzesPassed + 1,
            perfectQuizzes: score >= 1.0 ? s.perfectQuizzes + 1 : s.perfectQuizzes,
            passedQuizIds: newPassed,
          };
          return { ...updated, achievements: checkAchievements(updated) };
        });
        const xpAmount = score >= 1.0 ? 100 : score >= 0.75 ? 50 : 25;
        get().addXP(xpAmount, 'Quiz passed');
      },

      recordTreeStarted: () => {
        set((state) => {
          const updated = { ...state, treesStarted: state.treesStarted + 1 };
          return { ...updated, achievements: checkAchievements(updated) };
        });
        get().addXP(10, 'Tree started');
      },

      recordTreeCompleted: () => {
        set((state) => {
          const updated = { ...state, treesCompleted: state.treesCompleted + 1 };
          return { ...updated, achievements: checkAchievements(updated) };
        });
        get().addXP(200, 'Learning path completed');
      },

      updateStreak: () => {
        const today = getLocalCalendarDate();
        set((state) => {
          if (!state.lastActivityDate) {
            const updated = { ...state, streakDays: 1, lastActivityDate: today };
            return { ...updated, achievements: checkAchievements(updated) };
          }

          if (state.lastActivityDate === today) {
            return state;
          }

          const dayDiff = getDaysBetweenCalendarDates(state.lastActivityDate, today);
          let newStreak = 1;

          if (dayDiff === 1) {
            // Consecutive calendar day
            newStreak = state.streakDays + 1;
          } else if (dayDiff <= 0) {
            // Clock adjustment or same day, retain current streak
            return state;
          } else {
            // Day missed (dayDiff > 1), reset streak to 1
            newStreak = 1;
          }

          const updated = { ...state, streakDays: newStreak, lastActivityDate: today };
          return { ...updated, achievements: checkAchievements(updated) };
        });
      },

      resetGamification: () => set(initialState),
    }),
    {
      name: 'skilltree-gamification-v2',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
