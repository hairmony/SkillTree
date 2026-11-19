import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  GitFork,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Flame,
  ArrowRight,
  BarChart3,
  Search,
  Brain,
  Award,
  Clock,
  AlertCircle,
  Trophy,
} from 'lucide-react';
import { useTreeList } from '@/hooks/useTreeQueries';
import { treesApi } from '@/api';
import { useGamificationStore, useSettingsStore } from '@/stores';
import { EmptyState, ErrorMessage, ProgressBar, SkeletonCard, Badge } from '@/components/ui';
import { cn, formatPercent, formatRelativeTime } from '@/lib/utils';
import type { TreeDetail, TreeNode } from '@/types';

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtext,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary mb-1">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
        </div>
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ContinueLearningCard({
  treeId,
  title,
  treeData,
}: {
  treeId: string;
  title: string;
  treeData?: TreeDetail;
}) {
  const navigate = useNavigate();
  const mastered = treeData?.nodes.filter((n) => n.status === 'mastered').length ?? 0;
  const total = treeData?.nodes.length ?? 0;
  const progress = total > 0 ? mastered / total : 0;
  const nextUnlocked = treeData?.nodes.find((n) => n.status === 'unlocked');
  const reviewRequired = treeData?.nodes.find((n) => n.kind === 'required' && n.status !== 'mastered');

  return (
    <div className="card-hover flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-text-primary truncate">{title}</h3>
          <Badge
            variant={progress === 1 ? 'success' : reviewRequired ? 'danger' : progress > 0 ? 'purple' : 'default'}
            className="text-[10px] shrink-0"
          >
            {progress === 1
              ? 'Mastered'
              : reviewRequired
              ? 'Review Needed'
              : progress > 0
              ? 'In Progress'
              : 'Ready'}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
          <span>
            {mastered} / {total} concepts
          </span>
          <span>{formatPercent(progress)}</span>
        </div>
        <ProgressBar value={progress} size="sm" className="mb-3" />

        {reviewRequired ? (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-danger/10 text-danger text-xs mb-3">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Review: {reviewRequired.title}</span>
          </div>
        ) : nextUnlocked ? (
          <p className="text-xs text-text-muted mb-3 truncate">
            Next: <span className="text-text-primary font-medium">{nextUnlocked.title}</span>
          </p>
        ) : (
          <p className="text-xs text-text-muted mb-3">All available concepts mastered</p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-dark-elevated">
        {reviewRequired ? (
          <button
            onClick={() => navigate(`/trees/${treeId}/learn/${reviewRequired.id}`)}
            className="btn-danger flex-1 text-xs py-2 justify-center"
          >
            <BookOpen className="h-3.5 w-3.5" /> Study Review
          </button>
        ) : nextUnlocked ? (
          <button
            onClick={() => navigate(`/trees/${treeId}/learn/${nextUnlocked.id}`)}
            className="btn-primary flex-1 text-xs py-2 justify-center"
          >
            <BookOpen className="h-3.5 w-3.5" /> Continue Lesson
          </button>
        ) : (
          <button
            onClick={() => navigate(`/trees/${treeId}`)}
            className="btn-primary flex-1 text-xs py-2 justify-center"
          >
            Review Tree
          </button>
        )}
        <button
          onClick={() => navigate(`/trees/${treeId}`)}
          className="btn-secondary text-xs py-2 px-3 shrink-0"
          title="View DAG Map"
        >
          <GitFork className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: trees, isLoading: treesLoading, error: treesError } = useTreeList();
  const displayName = useSettingsStore((s) => s.displayName);
  const {
    xp,
    level,
    streakDays,
    lessonsCompleted,
    quizzesPassed,
    achievements,
    completedConceptIds,
    passedQuizIds,
  } = useGamificationStore();

  const treeIds = useMemo(() => (trees || []).slice(0, 8).map((t) => t.id), [trees]);
  const { data: treeDetails } = useQuery({
    queryKey: ['dashboard-trees', treeIds],
    queryFn: async () => {
      if (treeIds.length === 0) return [];
      const results = await Promise.allSettled(treeIds.map((id) => treesApi.get(id)));
      return results.map((r, i) => ({
        id: treeIds[i],
        data: r.status === 'fulfilled' ? r.value : undefined,
      }));
    },
    enabled: treeIds.length > 0,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const details = treeDetails || [];
    let totalConcepts = 0;
    let completedConcepts = 0;
    let activePaths = 0;

    details.forEach(({ data }) => {
      if (!data) return;
      totalConcepts += data.nodes.length;
      const mastered = data.nodes.filter((n) => n.status === 'mastered').length;
      completedConcepts += mastered;
      if (mastered > 0 && mastered < data.nodes.length) activePaths++;
    });

    return {
      totalTrees: trees?.length ?? 0,
      activePaths,
      completedConcepts,
      totalConcepts,
      overallProgress: totalConcepts > 0 ? completedConcepts / totalConcepts : 0,
    };
  }, [trees, treeDetails]);

  const continueTrees = useMemo(() => {
    if (!trees || !treeDetails) return [];
    return treeDetails
      .filter(({ data }) => {
        if (!data) return false;
        const mastered = data.nodes.filter((n) => n.status === 'mastered').length;
        return mastered > 0 && mastered < data.nodes.length;
      })
      .slice(0, 3);
  }, [trees, treeDetails]);

  // Next available unlocked concepts across all active trees
  const nextAvailableConcepts = useMemo(() => {
    if (!treeDetails || !trees) return [];
    const available: {
      treeId: string;
      treeTitle: string;
      node: TreeNode;
    }[] = [];

    treeDetails.forEach(({ id, data }) => {
      if (!data) return;
      const treeTitle = trees.find((t) => t.id === id)?.title || id;
      data.nodes
        .filter((n) => n.status === 'unlocked')
        .forEach((node) => {
          available.push({ treeId: id, treeTitle, node });
        });
    });

    return available.slice(0, 4);
  }, [treeDetails, trees]);

  // Recently completed topics across trees
  const recentlyCompletedTopics = useMemo(() => {
    if (!treeDetails || !trees) return [];
    const completed: {
      treeId: string;
      treeTitle: string;
      node: TreeNode;
    }[] = [];

    treeDetails.forEach(({ id, data }) => {
      if (!data) return;
      const treeTitle = trees.find((t) => t.id === id)?.title || id;
      data.nodes
        .filter((n) => n.status === 'mastered')
        .forEach((node) => {
          completed.push({ treeId: id, treeTitle, node });
        });
    });

    return completed.slice(0, 4);
  }, [treeDetails, trees]);

  // Recent activity stream (from unlocked achievements & completed concept keys)
  const recentActivities = useMemo(() => {
    type ActivityItem = {
      id: string;
      icon: React.ElementType;
      iconColor: string;
      title: string;
      description: string;
      timestamp: string;
      link?: string;
    };
    const items: ActivityItem[] = [];

    // Recent achievements
    achievements
      .filter((a) => Boolean(a.unlockedAt))
      .forEach((a) => {
        items.push({
          id: `ach-${a.id}`,
          icon: Award,
          iconColor: 'bg-warning/10 text-warning',
          title: `Unlocked: ${a.title}`,
          description: a.description,
          timestamp: a.unlockedAt!,
          link: '/achievements',
        });
      });

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [achievements]);

  if (treesError) {
    return (
      <ErrorMessage
        message={(treesError as Error).message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">
            Welcome back, {displayName}! 👋
          </h2>
          <p className="text-text-secondary mt-1">
            Adaptive directed acyclic graphs customized to your learning pace and mastery
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/explore" className="btn-secondary">
            <Search className="h-4 w-4" /> Explore
          </Link>
          <Link to="/trees/create" className="btn-primary">
            <Plus className="h-4 w-4" /> Create Skill Tree
          </Link>
        </div>
      </div>

      {/* Primary Metrics Row */}
      {treesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={GitFork}
            label="My Learning Trees"
            value={stats.totalTrees}
            color="bg-accent-purple/10 text-accent-purple"
            subtext={stats.activePaths > 0 ? `${stats.activePaths} in progress` : 'All caught up'}
          />
          <StatCard
            icon={CheckCircle2}
            label="Concepts Mastered"
            value={stats.completedConcepts}
            color="bg-success/10 text-success"
            subtext={`of ${stats.totalConcepts} curriculum concepts`}
          />
          <StatCard
            icon={TrendingUp}
            label="Curriculum Progress"
            value={formatPercent(stats.overallProgress)}
            color="bg-accent-cyan/10 text-accent-cyan"
            subtext="DAG completion rate"
          />
          <StatCard
            icon={Flame}
            label="Learning Streak"
            value={`${streakDays} Days`}
            color="bg-danger/10 text-danger"
            subtext="Consecutive days active"
          />
        </div>
      )}

      {/* Continue Learning Section */}
      {continueTrees.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Continue Learning</h3>
              <p className="text-xs text-text-secondary">Pick up where you left off</p>
            </div>
            <Link to="/trees" className="text-sm text-accent-purple hover:text-accent-purple-hover flex items-center gap-1">
              View all trees <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continueTrees.map(({ id, data }) => {
              const title = trees?.find((t) => t.id === id)?.title ?? id;
              return <ContinueLearningCard key={id} treeId={id} title={title} treeData={data} />;
            })}
          </div>
        </div>
      )}

      {/* Next Available Concepts across trees */}
      {nextAvailableConcepts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Next Available Concepts</h3>
              <p className="text-xs text-text-secondary">
                Prerequisites satisfied — ready to learn across your active pathways
              </p>
            </div>
            <Link to="/trees" className="text-xs text-accent-purple hover:text-accent-purple-hover">
              Browse pathways →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {nextAvailableConcepts.map(({ treeId, treeTitle, node }) => (
              <div key={`${treeId}-${node.id}`} className="card-hover flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="purple" className="text-[10px] truncate max-w-[130px]">
                      {treeTitle}
                    </Badge>
                    {node.kind !== 'core' && (
                      <Badge
                        variant={node.kind === 'required' ? 'danger' : 'warning'}
                        className="text-[10px]"
                      >
                        {node.kind}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-text-primary line-clamp-1 mb-1">
                    {node.title}
                  </h4>
                  <p className="text-xs text-text-secondary line-clamp-2 mb-3">
                    {node.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-dark-elevated">
                  <Link
                    to={`/trees/${treeId}/learn/${node.id}`}
                    className="btn-primary flex-1 text-xs py-1.5 justify-center"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Start Lesson
                  </Link>
                  <Link
                    to={`/trees/${treeId}/quiz/${node.id}`}
                    className="btn-secondary text-xs py-1.5 px-2.5 justify-center"
                    title="Take Assessment"
                  >
                    <Brain className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Completed Topics */}
      {recentlyCompletedTopics.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Recently Mastered Topics</h3>
              <p className="text-xs text-text-secondary">
                Concepts where you have satisfied mastery through quizzes or completion
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentlyCompletedTopics.map(({ treeId, treeTitle, node }) => (
              <div key={`mastered-${treeId}-${node.id}`} className="card p-3.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    <span className="text-[11px] text-text-muted truncate">{treeTitle}</span>
                  </div>
                  <h4 className="font-semibold text-xs text-text-primary truncate">{node.title}</h4>
                </div>
                <Link
                  to={`/trees/${treeId}/learn/${node.id}`}
                  className="btn-ghost text-xs p-1.5 text-text-muted hover:text-text-primary"
                  title="Review concept"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scholar Profile & Achievements Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scholar Gamification Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-text-primary">Scholar Profile</h3>
              <Badge variant="purple" className="text-[10px]">
                Level {level}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-dark-primary border border-dark-elevated text-center">
                <p className="text-xl font-bold text-accent-cyan">{lessonsCompleted}</p>
                <p className="text-[11px] text-text-muted mt-0.5">Lessons Studied</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-primary border border-dark-elevated text-center">
                <p className="text-xl font-bold text-success">{quizzesPassed}</p>
                <p className="text-[11px] text-text-muted mt-0.5">Quizzes Passed</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                <span>Experience Points</span>
                <span className="font-semibold text-accent-purple">{xp} total XP</span>
              </div>
              <ProgressBar value={(xp % 100) / 100} size="sm" color="purple" />
              <p className="text-[11px] text-text-muted mt-1.5 text-right">
                {100 - (xp % 100)} XP to Level {level + 1}
              </p>
            </div>
          </div>
          <div className="pt-4 border-t border-dark-elevated mt-4">
            <Link to="/achievements" className="btn-secondary w-full text-xs justify-center">
              <Award className="h-3.5 w-3.5" /> View All Achievements
            </Link>
          </div>
        </div>

        {/* Real Achievements Showcase */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">Recent Achievements</h3>
            <Link to="/achievements" className="text-xs text-accent-purple hover:underline">
              View All ({achievements.filter((a) => a.unlockedAt).length}/{achievements.length})
            </Link>
          </div>
          {recentActivities.length > 0 ? (
            <div className="space-y-2.5">
              {recentActivities.map((act) => {
                const Icon = act.icon;
                return (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-dark-primary border border-dark-elevated text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                          act.iconColor
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary truncate">{act.title}</p>
                        <p className="text-text-muted truncate">{act.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-text-muted">{formatRelativeTime(act.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-text-muted space-y-2">
              <Trophy className="h-8 w-8 mx-auto text-text-muted/60" />
              <p>No achievements unlocked yet.</p>
              <p className="text-text-secondary">
                Complete your first lesson or take a quiz to earn your first scholar badge!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/trees/create" className="card-hover group">
            <div className="h-10 w-10 rounded-xl bg-accent-purple/10 flex items-center justify-center mb-3 group-hover:bg-accent-purple/20 transition-colors">
              <Plus className="h-5 w-5 text-accent-purple" />
            </div>
            <h4 className="font-semibold text-text-primary">Create Skill Tree</h4>
            <p className="text-sm text-text-secondary mt-1">
              Start learning a new topic with AI-generated branching DAGs
            </p>
          </Link>
          <Link to="/explore" className="card-hover group">
            <div className="h-10 w-10 rounded-xl bg-accent-cyan/10 flex items-center justify-center mb-3 group-hover:bg-accent-cyan/20 transition-colors">
              <Search className="h-5 w-5 text-accent-cyan" />
            </div>
            <h4 className="font-semibold text-text-primary">Explore Pathways</h4>
            <p className="text-sm text-text-secondary mt-1">
              Search cross-curriculum concepts, definitions, and citations
            </p>
          </Link>
          <Link to="/analytics" className="card-hover group">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center mb-3 group-hover:bg-success/20 transition-colors">
              <BarChart3 className="h-5 w-5 text-success" />
            </div>
            <h4 className="font-semibold text-text-primary">Learning Analytics</h4>
            <p className="text-sm text-text-secondary mt-1">
              Track Bayesian Knowledge Tracing scores and weak concepts
            </p>
          </Link>
        </div>
      </div>

      {/* Empty State if No Trees Exist */}
      {!treesLoading && stats.totalTrees === 0 && (
        <EmptyState
          icon={GitFork}
          title="No skill trees yet"
          description="Create your first skill tree to synthesize an adaptive learning pathway grounded in free academic resources."
          action={
            <Link to="/trees/create" className="btn-primary">
              <Sparkles className="h-4 w-4" />
              Create Your First Skill Tree
            </Link>
          }
        />
      )}
    </div>
  );
}
