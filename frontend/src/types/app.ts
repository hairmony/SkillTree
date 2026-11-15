import type { TreeSummary, TreeNode } from './api';

// ========== Gamification ==========

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  requirement: AchievementRequirement;
}

export interface AchievementRequirement {
  type: 'lessons_completed' | 'quizzes_passed' | 'trees_started' | 'trees_completed' | 'streak_days' | 'perfect_quiz';
  count: number;
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

// ========== Notes ==========

export interface Note {
  id: string;
  title: string;
  content: string;
  treeId: string | null;
  nodeId: string | null;
  treeName: string | null;
  nodeName: string | null;
  createdAt: string;
  updatedAt: string;
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

// ========== Documents ==========

export interface LocalDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  treeId: string | null;
  status: 'pending' | 'processing' | 'ingested' | 'failed';
  chunksAdded: number;
  error: string | null;
  addedAt: string;
}

// ========== Navigation ==========

export type PageId = 
  | 'dashboard'
  | 'trees'
  | 'explore'
  | 'analytics'
  | 'achievements'
  | 'notes'
  | 'documents'
  | 'reports'
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
