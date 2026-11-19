import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Achievement, GamificationState } from '@/types/app';

export const ACHIEVEMENTS_DEFINITIONS: Omit<Achievement, 'unlockedAt'>[] = [
  {
    id: 'learning_starter',
    title: 'Learning Starter',
    description: 'Complete your first learning concept.',
    icon: 'book-open',
    category: 'progress',
    requirement: { type: 'lessons_completed', count: 1 },
  },
  {
    id: 'knowledge_builder',
    title: 'Knowledge Builder',
    description: 'Complete 5 learning concepts.',
    icon: 'layers',
    category: 'progress',
    requirement: { type: 'lessons_completed', count: 5 },
  },
  {
    id: 'assessment_proficiency',
    title: 'Assessment Proficiency',
    description: 'Pass 5 quizzes with scores of at least 75%.',
    icon: 'shield-check',
    category: 'mastery',
    requirement: { type: 'quizzes_passed', count: 5 },
  },
  {
    id: 'academic_excellence',
    title: 'Academic Excellence',
    description: 'Score 100% on any quiz.',
    icon: 'star',
    category: 'mastery',
    requirement: { type: 'perfect_quiz', count: 1 },
  },
  {
    id: 'consistent_learner',
    title: 'Consistent Learner',
    description: 'Maintain a 7-day active learning streak.',
    icon: 'flame',
    category: 'consistency',
    requirement: { type: 'streak_days', count: 7 },
  },
  {
    id: 'curriculum_mastery',
    title: 'Curriculum Mastery',
    description: 'Complete all required learning concepts in one Skill Tree.',
    icon: 'award',
    category: 'progress',
    requirement: { type: 'trees_completed', count: 1 },
  },
];

const ALIAS_MAP: Record<string, string[]> = {
  learning_starter: ['first_step', 'first_milestone', 'learning_starter'],
  knowledge_builder: ['knowledge_seeker', 'knowledge_explorer', 'knowledge_builder'],
  assessment_proficiency: ['quiz_champion', 'assessment_proficiency'],
  academic_excellence: ['perfectionist', 'quiz_excellence', 'academic_excellence'],
  consistent_learner: ['streak_7', 'consistent_learner'],
  curriculum_mastery: ['path_master', 'learning_specialist', 'curriculum_mastery'],
};

interface GamificationActions {
  addXP: (amount: number, reason: string) => void;
  recordLessonCompleted: (treeId?: string, nodeId?: string) => void;
  recordQuizPassed: (score: number, treeId?: string, nodeId?: string) => void;
  recordTreeStarted: () => void;
  recordTreeCompleted: () => void;
  updateStreak: () => void;
  resetGamification: () => void;
}

export function checkAchievements(state: GamificationState): Achievement[] {
  return ACHIEVEMENTS_DEFINITIONS.map((def) => {
    const aliases = ALIAS_MAP[def.id] || [];
    const existing = state.achievements?.find(
      (a) => a.id === def.id || aliases.includes(a.id)
    );
    if (existing?.unlockedAt) {
      return { ...def, unlockedAt: existing.unlockedAt };
    }

    let unlocked = false;
    switch (def.requirement.type) {
      case 'lessons_completed':
        unlocked = (state.lessonsCompleted ?? 0) >= def.requirement.count;
        break;
      case 'quizzes_passed':
        unlocked = (state.quizzesPassed ?? 0) >= def.requirement.count;
        break;
      case 'perfect_quiz':
        unlocked = (state.perfectQuizzes ?? 0) >= def.requirement.count;
        break;
      case 'streak_days':
        unlocked = (state.streakDays ?? 0) >= def.requirement.count;
        break;
      case 'trees_completed':
        unlocked = (state.treesCompleted ?? 0) >= def.requirement.count;
        break;
      case 'trees_started':
        unlocked = (state.treesStarted ?? 0) >= def.requirement.count;
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

const baseState: GamificationState = {
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
  version: 6,
};

function getMigratedInitialState(): GamificationState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const v6 = localStorage.getItem('skilltree-gamification-v6');
      if (!v6) {
        // Safe backward migration from previous localStorage keys without deleting user progress
        const prevKeys = [
          'skilltree-gamification-v4',
          'skilltree-gamification-v3',
          'skilltree-gamification-v2',
          'skilltree-gamification',
        ];
        for (const k of prevKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            const oldState = parsed.state || parsed;
            const merged: GamificationState = {
              ...baseState,
              xp: oldState.xp || 0,
              level: oldState.level || 1,
              streakDays: oldState.streakDays || 0,
              lastActivityDate: oldState.lastActivityDate || null,
              lessonsCompleted: oldState.lessonsCompleted || 0,
              quizzesPassed: oldState.quizzesPassed || 0,
              perfectQuizzes: oldState.perfectQuizzes || 0,
              treesStarted: oldState.treesStarted || 0,
              treesCompleted: oldState.treesCompleted || 0,
              completedConceptIds: oldState.completedConceptIds || [],
              passedQuizIds: oldState.passedQuizIds || [],
              version: 6,
              achievements: [],
            };
            merged.achievements = checkAchievements(merged);
            localStorage.setItem('skilltree-gamification-v6', JSON.stringify({ state: merged, version: 6 }));
            return merged;
          }
        }
      }
    } catch {
      // Ignore parse errors and fallback to baseState
    }
  }
  return baseState;
}

const initialState: GamificationState = getMigratedInitialState();

export const useGamificationStore = create<GamificationState & GamificationActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      addXP: (amount: number, _reason: string) => {
        set((state) => {
          const newXP = state.xp + amount;
          const newLevel = Math.floor(newXP / 100) + 1;
          const updated = { ...state, xp: newXP, level: newLevel };
          return { ...updated, achievements: checkAchievements(updated) };
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

      resetGamification: () => set(baseState),
    }),
    {
      name: 'skilltree-gamification-v6',
      storage: createJSONStorage(() => localStorage),
      version: 6,
      migrate: (persistedState: unknown) => {
        const state = persistedState as GamificationState;
        return {
          ...state,
          achievements: checkAchievements(state),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.achievements = checkAchievements(state);
        }
      },
    }
  )
);
