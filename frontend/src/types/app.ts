// ========== Gamification ==========

export type AchievementCategory =
  | 'getting_started'
  | 'progress'
  | 'mastery'
  | 'consistency'
  | 'experience';

export interface AchievementRequirement {
  type:
    | 'lessons_completed'
    | 'quizzes_passed'
    | 'trees_started'
    | 'trees_completed'
    | 'streak_days'
    | 'perfect_quiz'
    | 'level_reached';
  count: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  unlockedAt: string | null;
  requirement: AchievementRequirement;
}

export interface GamificationState {
  xp: number;
  level: number;
  achievements: Achievement[];
  streakDays: number;
  lastActivityDate: string | null;
  lessonsCompleted: number;
  quizzesPassed: number;
  perfectQuizzes: number;
  treesStarted: number;
  treesCompleted: number;
  completedConceptIds: string[];
  passedQuizIds: string[];
  version: number;
}

// ========== Settings ==========

export interface UserSettings {
  displayName: string;
  animationsEnabled: boolean;
  notificationsEnabled: boolean;
  reducedMotion: boolean;
  autoAdvance: boolean;
  quizQuestionCount: number;
  version: number;
}

// ========== Navigation ==========

export type PageId =
  | 'dashboard'
  | 'trees'
  | 'explore'
  | 'analytics'
  | 'achievements'
  | 'settings';

export interface NavItem {
  id: PageId;
  label: string;
  path: string;
  icon: string;
}

// ========== Dashboard ==========

export interface DashboardStats {
  totalTrees: number;
  activePaths: number;
  completedConcepts: number;
  totalConcepts: number;
  overallProgress: number;
  quizAverage: number;
  totalXP: number;
}

export interface ContinueLearningCard {
  treeId: string;
  treeName: string;
  progress: number;
  completedNodes: number;
  totalNodes: number;
  lastAccessed: string;
}
