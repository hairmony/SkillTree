import { describe, it, expect, beforeEach } from 'vitest';
import { useGamificationStore, useSettingsStore } from '@/stores';

describe('Zustand Stores', () => {
  beforeEach(() => {
    useGamificationStore.getState().resetGamification();
    useSettingsStore.getState().resetSettings();
  });

  describe('useGamificationStore', () => {
    it('initializes with level 1 and 0 XP and exactly 6 achievements', () => {
      const state = useGamificationStore.getState();
      expect(state.level).toBe(1);
      expect(state.xp).toBe(0);
      expect(state.streakDays).toBe(0);
      expect(state.achievements.length).toBe(6);
    });

    it('adds XP and levels up at 100 XP', () => {
      const store = useGamificationStore.getState();
      store.addXP(50, 'Test 1');
      expect(useGamificationStore.getState().xp).toBe(50);
      expect(useGamificationStore.getState().level).toBe(1);

      store.addXP(60, 'Test 2');
      expect(useGamificationStore.getState().xp).toBe(110);
      expect(useGamificationStore.getState().level).toBe(2);
    });

    it('unlocks Learning Starter on first completed lesson', () => {
      const store = useGamificationStore.getState();
      store.recordLessonCompleted('tree-a', 'node-1');

      const state = useGamificationStore.getState();
      expect(state.lessonsCompleted).toBe(1);
      expect(state.completedConceptIds).toContain('tree-a:node-1');
      const starter = state.achievements.find((a) => a.id === 'learning_starter');
      expect(starter?.unlockedAt).not.toBeNull();
    });

    it('prevents duplicate XP when completing the same lesson multiple times', () => {
      const store = useGamificationStore.getState();
      store.recordLessonCompleted('tree-a', 'node-1');
      const xpAfterFirst = useGamificationStore.getState().xp;
      const countAfterFirst = useGamificationStore.getState().lessonsCompleted;

      // Complete the exact same node again
      store.recordLessonCompleted('tree-a', 'node-1');
      const stateAfterSecond = useGamificationStore.getState();

      expect(stateAfterSecond.xp).toBe(xpAfterFirst);
      expect(stateAfterSecond.lessonsCompleted).toBe(countAfterFirst);
      expect(stateAfterSecond.completedConceptIds).toHaveLength(1);

      // Complete a different node: should grant XP
      store.recordLessonCompleted('tree-a', 'node-2');
      expect(useGamificationStore.getState().xp).toBeGreaterThan(xpAfterFirst);
      expect(useGamificationStore.getState().lessonsCompleted).toBe(countAfterFirst + 1);
    });

    it('awards extra XP for perfect quiz score and unlocks Academic Excellence achievement', () => {
      const store = useGamificationStore.getState();
      store.recordQuizPassed(1.0, 'tree-a', 'node-1');

      const state = useGamificationStore.getState();
      expect(state.quizzesPassed).toBe(1);
      expect(state.perfectQuizzes).toBe(1);
      expect(state.xp).toBe(100);
      expect(state.passedQuizIds).toContain('tree-a:node-1');

      const excellence = state.achievements.find((a) => a.id === 'academic_excellence');
      expect(excellence?.unlockedAt).not.toBeNull();

      // Repeat the same passed quiz: prevents duplicate base XP
      store.recordQuizPassed(1.0, 'tree-a', 'node-1');
      const stateAfterRepeat = useGamificationStore.getState();
      expect(stateAfterRepeat.quizzesPassed).toBe(1);
      expect(stateAfterRepeat.xp).toBe(100);
    });

    it('updates streak based on calendar day difference', () => {
      const store = useGamificationStore.getState();
      // First activity
      store.recordLessonCompleted('tree-a', 'node-1');
      expect(useGamificationStore.getState().streakDays).toBe(1);

      // Repeat on same day: streak remains 1
      store.recordLessonCompleted('tree-a', 'node-2');
      expect(useGamificationStore.getState().streakDays).toBe(1);
    });

    it('awards XP and unlocks Curriculum Mastery when completing an entire tree', () => {
      const store = useGamificationStore.getState();
      store.recordTreeCompleted();

      const state = useGamificationStore.getState();
      expect(state.treesCompleted).toBe(1);
      expect(state.xp).toBe(200);

      const mastery = state.achievements.find((a) => a.id === 'curriculum_mastery');
      expect(mastery?.unlockedAt).not.toBeNull();
    });
  });

  describe('useSettingsStore', () => {
    it('updates user display name', () => {
      const store = useSettingsStore.getState();
      expect(store.displayName).toBe('Learner');

      store.updateSettings({ displayName: 'Research Scholar' });
      expect(useSettingsStore.getState().displayName).toBe('Research Scholar');
    });

    it('toggles reduced motion mode', () => {
      const store = useSettingsStore.getState();
      expect(store.reducedMotion).toBe(false);

      store.updateSettings({ reducedMotion: true });
      expect(useSettingsStore.getState().reducedMotion).toBe(true);
    });

    it('updates assessment question count preference', () => {
      const store = useSettingsStore.getState();
      expect(store.quizQuestionCount).toBe(5);

      store.updateSettings({ quizQuestionCount: 3 });
      expect(useSettingsStore.getState().quizQuestionCount).toBe(3);
    });
  });
});
