import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppLayout } from '@/components/layout';
import { LoadingSpinner } from '@/components/ui';

// Lazy-loaded pages for code splitting
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const TreeListPage = lazy(() => import('@/features/trees/TreeListPage'));
const TreeViewPage = lazy(() => import('@/features/trees/TreeViewPage'));
const CreateTreePage = lazy(() => import('@/features/trees/CreateTreePage'));
const LessonPage = lazy(() => import('@/features/learning/LessonPage'));
const QuizPage = lazy(() => import('@/features/quizzes/QuizPage'));
const QuizHistoryPage = lazy(() => import('@/features/quizzes/QuizHistoryPage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const AchievementsPage = lazy(() => import('@/features/gamification/AchievementsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const ExplorePage = lazy(() => import('@/features/search/ExplorePage'));

function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" label="Loading..." />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="trees"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <TreeListPage />
            </Suspense>
          }
        />
        <Route
          path="trees/create"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <CreateTreePage />
            </Suspense>
          }
        />
        <Route
          path="trees/:treeId"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <TreeViewPage />
            </Suspense>
          }
        />
        <Route
          path="trees/:treeId/learn/:nodeId"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <LessonPage />
            </Suspense>
          }
        />
        <Route
          path="trees/:treeId/quiz/:nodeId"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <QuizPage />
            </Suspense>
          }
        />
        <Route
          path="trees/:treeId/quizzes"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <QuizHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="explore"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <ExplorePage />
            </Suspense>
          }
        />
        <Route
          path="analytics"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="achievements"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <AchievementsPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />

        {/* Redirect removed and legacy routes to My Skill Trees */}
        <Route path="learning" element={<Navigate to="/trees" replace />} />
        <Route path="quizzes" element={<Navigate to="/trees" replace />} />
        <Route path="notes" element={<Navigate to="/trees" replace />} />
        <Route path="documents" element={<Navigate to="/trees" replace />} />
        <Route path="reports" element={<Navigate to="/trees" replace />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
