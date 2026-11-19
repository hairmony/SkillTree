# SkillTree Frontend Changelog & Component Evolution

This document tracks all frontend development milestones, architectural decisions, and component updates across the **SkillTree** web application.

---

## Component Architecture & Feature Breakdown

### 1. Dashboard & Learning Statistics
- **Location**: `src/features/dashboard/DashboardPage.tsx`
- **Capabilities**:
  - Student learning overview displaying active streaks, total XP, current academic level, and mastery ratios.
  - Recent pathway shortcuts with direct links to continue learning trees.
  - Interactive concept status breakdown (Mastered, In Progress, Locked).
  - Responsive metric cards with subtle animations and dark-mode styling.

### 2. Skill Tree Visualization (DAG)
- **Location**: `src/features/trees/TreeViewPage.tsx`, `CreateTreePage.tsx`, `TreeListPage.tsx`
- **Capabilities**:
  - Interactive Directed Acyclic Graph (DAG) rendering powered by `@xyflow/react`.
  - Color-coded node states based on backend Bayesian Knowledge Tracing (BKT) status: *Locked*, *Unlocked*, and *Mastered*.
  - Directed prerequisite edge visualization with dynamic layouts.
  - Curriculum topic creation interface and pathway catalog with search and filtering.

### 3. Learning Resources & Explore Pathways
- **Location**: `src/features/learning/LessonPage.tsx`, `src/features/search/ExplorePage.tsx`
- **Capabilities**:
  - Markdown-rendered lesson reader for individual concept nodes with code syntax highlighting.
  - External educational reference links and source grounding.
  - Explore view for discovering new subjects and curated curriculum pathways.
  - "Take Quiz" action button routing directly to concept assessment.

### 4. Quiz Generation & Assessment Interface
- **Location**: `src/features/quizzes/QuizPage.tsx`, `QuizHistoryPage.tsx`
- **Capabilities**:
  - Multiple-choice question runner with single-select answers and immediate validation.
  - Real-time submission handling with backend adaptive scoring and remediation feedback.
  - Dynamic display of new remediation nodes inserted into the learning tree upon sub-75% quiz scores.
  - Historical assessment logs displaying past quiz scores, timestamps, and missed topics.

### 5. Analytics & Dynamic Knowledge Gaps
- **Location**: `src/features/analytics/AnalyticsPage.tsx`
- **Capabilities**:
  - Recharts visual charts: Path completion percentages, concept mastery distributions, and recent assessment score trends.
  - **Dynamic Knowledge Gaps**:
    - *Condition 1 (No quizzes completed)*: Displays prompt to take an assessment.
    - *Condition 2 (Quizzes passed, no gaps)*: Displays clean status with no recurring weaknesses.
    - *Condition 3 (Knowledge gaps detected)*: Shows missed concept names, exact score percentages, "Needs Review" status badge, and direct links to the relevant lesson.
  - Excised technical notices to preserve focus on student learning metrics.

### 6. Achievements & XP System
- **Location**: `src/features/gamification/AchievementsPage.tsx`, `src/stores/useGamificationStore.ts`
- **Capabilities**:
  - Exactly **six** meaningful academic milestones:
    1. *Learning Starter* (Complete 1st concept)
    2. *Knowledge Builder* (Complete 5 concepts)
    3. *Assessment Proficiency* (Pass 5 quizzes with $\ge 75\%$)
    4. *Academic Excellence* (Score $100\%$ on any quiz)
    5. *Consistent Learner* (Maintain a 7-day study streak)
    6. *Curriculum Mastery* (Complete all required concepts in a tree)
  - Persistent state under `skilltree-gamification-v6` with safe browser migration and dynamic recalculation.

### 7. Settings & User Profile
- **Location**: `src/features/settings/SettingsPage.tsx`, `src/stores/useSettingsStore.ts`
- **Capabilities**:
  - Student display name customization with instant UI updates and toast feedback.
  - Theme mode preferences (Dark / Light / System).
  - Daily study goal reminders (15m, 30m, 45m, 60m).
  - Accessibility preferences (Reduced Motion toggle, Interface Animations toggle, Sound Effects).
  - Default quiz question count selector.
  - Removed disruptive "Data Management" reset actions for safety.

### 8. Shared Layout & Responsive Navigation
- **Location**: `src/components/layout/AppLayout.tsx`, `Sidebar.tsx`, `TopBar.tsx`
- **Capabilities**:
  - Collapsible sidebar with exactly 6 core navigation routes.
  - Clean top bar displaying current page title, learner avatar, and direct navigation to profile settings.
  - Removed redundant search and notification header buttons.
  - Mobile drawer navigation with responsive hamburger toggle.

### 9. API Integration & State Management
- **Location**: `src/api/`, `src/stores/`, `src/hooks/`
- **Capabilities**:
  - Axios client configured with automatic `/api` base URL proxying to FastAPI (`http://localhost:8000`).
  - TanStack React Query hooks with automatic caching and cache invalidation on quiz submission.
  - Zustand stores managing ephemeral UI state (`useAppStore`), persistent gamification (`useGamificationStore`), and user preferences (`useSettingsStore`).

---

## Release & Commit History

### [1.2.0] — 2026-11-18
- **Commit**: `6bcbb35` — `docs(frontend): add setup and development instructions`
- Added comprehensive `frontend/README.md` detailing prerequisites, installation commands (`npm install`, `npm run dev`), scripts, and FastAPI proxy setup.

### [1.1.0] — 2026-11-18
- **Commit**: `fedb80b` — `Replace previous frontend with updated SkillTree React application`
- Refined Achievements page to exactly 6 academic milestones with dynamic verification.
- Simplified Settings page by removing the Data Management reset section.
- Cleaned TopBar navigation by removing unused Search and Notification bell buttons; linked learner avatar to `/settings`.
- Updated Analytics page: removed "Research Data Provenance" notice and implemented dynamic 3-condition Knowledge Gaps card with direct lesson links.
- Deleted obsolete feature files (`DocumentsPage`, `NotesPage`, `ReportsPage`, `canvg-mock`, `useNotesStore`).
- Expanded test suite to 35 passing tests across stores, utils, Sidebar, and TopBar.

### [1.0.1] — 2026-11-16
- **Commits**: `a2788aa`, `3fd5615`
- Restored `src/lib/utils.ts` and added mock utilities for build compatibility.
- Cleaned root `.gitignore` to prevent committing build caches.

### [1.0.0] — 2026-11-15
- **Commit**: `2b86407` — `Add SkillTree frontend implementation`
- Initial production implementation of the SkillTree frontend Single-Page Application (SPA).
- Scaffolded React 18, Vite, TypeScript, Tailwind CSS, Zustand, and React Flow.
