import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { BarChart3, TrendingUp, CheckCircle2, Brain, AlertCircle, Info } from 'lucide-react';
import { useTreeList } from '@/hooks/useTreeQueries';
import { treesApi, quizzesApi } from '@/api';
import { useGamificationStore } from '@/stores';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/components/ui';
import { formatPercent } from '@/lib/utils';
import type { TreeDetail, QuizHistoryItem } from '@/types';

const COLORS = ['#8B5CF6', '#22D3EE', '#22C55E', '#F59E0B', '#EF4444', '#EC4899'];

export default function AnalyticsPage() {
  const { data: trees, isLoading: treesLoading, error: treesError } = useTreeList();
  const { xp, level, lessonsCompleted, quizzesPassed, streakDays } = useGamificationStore();

  const treeIds = useMemo(() => (trees || []).map((t) => t.id), [trees]);

  const { data: treeDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['analytics-trees', treeIds],
    queryFn: async () => {
      if (treeIds.length === 0) return [];
      const results = await Promise.allSettled(treeIds.map((id) => treesApi.get(id)));
      return results.map((r, i) => ({
        id: treeIds[i],
        title: trees?.[i]?.title || treeIds[i],
        data: r.status === 'fulfilled' ? (r.value as TreeDetail) : undefined,
      }));
    },
    enabled: treeIds.length > 0,
    staleTime: 30_000,
  });

  const { data: allQuizzes, isLoading: quizzesLoading } = useQuery({
    queryKey: ['analytics-quizzes', treeIds],
    queryFn: async () => {
      if (treeIds.length === 0) return [];
      const results = await Promise.allSettled(treeIds.map((id) => quizzesApi.getHistory(id)));
      const combined: (QuizHistoryItem & { treeTitle: string })[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          const title = trees?.[i]?.title || treeIds[i];
          r.value.forEach((q) => combined.push({ ...q, treeTitle: title }));
        }
      });
      return combined;
    },
    enabled: treeIds.length > 0,
    staleTime: 30_000,
  });

  const pathCompletionData = useMemo(() => {
    if (!treeDetails) return [];
    return treeDetails
      .filter((t) => t.data)
      .map((t) => {
        const total = t.data!.nodes.length;
        const mastered = t.data!.nodes.filter((n) => n.status === 'mastered').length;
        const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;
        return {
          name: t.title.length > 15 ? t.title.substring(0, 15) + '...' : t.title,
          mastered,
          pending: total - mastered,
          percentage,
        };
      });
  }, [treeDetails]);

  const nodeStatusDistribution = useMemo(() => {
    if (!treeDetails) return [];
    let mastered = 0;
    let unlocked = 0;
    let locked = 0;

    treeDetails.forEach((t) => {
      if (!t.data) return;
      t.data.nodes.forEach((n) => {
        if (n.status === 'mastered') mastered++;
        else if (n.status === 'unlocked') unlocked++;
        else locked++;
      });
    });

    return [
      { name: 'Mastered', value: mastered, color: '#22C55E' },
      { name: 'Unlocked', value: unlocked, color: '#8B5CF6' },
      { name: 'Locked', value: locked, color: '#334155' },
    ];
  }, [treeDetails]);

  const quizPerformanceData = useMemo(() => {
    if (!allQuizzes || allQuizzes.length === 0) return [];
    return allQuizzes.slice(0, 10).reverse().map((q, idx) => ({
      quizNumber: `#${idx + 1}`,
      concept: q.title || q.node_id,
      score: Math.round(q.score * 100),
    }));
  }, [allQuizzes]);

  const weakTopics = useMemo(() => {
    if (!allQuizzes) return [];
    const missedCounts: Record<string, number> = {};
    allQuizzes.forEach((q) => {
      q.missed_concepts.forEach((c) => {
        if (c) missedCounts[c] = (missedCounts[c] || 0) + 1;
      });
    });
    return Object.entries(missedCounts)
      .map(([concept, count]) => ({ concept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allQuizzes]);

  const isLoading = treesLoading || detailsLoading || quizzesLoading;

  if (treesError) {
    return <ErrorMessage message={(treesError as Error).message} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Learning Analytics</h2>
          <p className="text-sm text-text-secondary mt-1">
            Empirical data derived from real DAG traversal and Bayesian Knowledge Tracing (BKT)
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-hover">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-accent-purple/10 flex items-center justify-center text-accent-purple">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-sm text-text-secondary">Total XP Acquired</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{xp}</p>
          <p className="text-xs text-text-muted mt-1">Level {level} Scholar</p>
        </div>

        <div className="card-hover">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-sm text-text-secondary">Lessons Finished</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{lessonsCompleted}</p>
          <p className="text-xs text-text-muted mt-1">Across all skill trees</p>
        </div>

        <div className="card-hover">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-accent-cyan/10 flex items-center justify-center text-accent-cyan">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-sm text-text-secondary">Quizzes Submitted</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{quizzesPassed}</p>
          <p className="text-xs text-text-muted mt-1">{allQuizzes?.length || 0} total attempts</p>
        </div>

        <div className="card-hover">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="text-sm text-text-secondary">Active Learning Streak</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{streakDays} Days</p>
          <p className="text-xs text-text-muted mt-1">Continuous engagement</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" label="Compiling analytics models..." className="py-20" />
      ) : pathCompletionData.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics recorded yet"
          description="Create skill trees and take assessments to populate your performance metrics."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Path Completion Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text-primary">
                Path Completion Percentage
              </h3>
              <span className="text-xs text-text-muted">Calculated from /trees</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pathCompletionData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748B" tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#172033', borderColor: '#1E293B', borderRadius: '8px', color: '#F8FAFC' }}
                    formatter={(val: number) => [`${val}%`, 'Completion']}
                  />
                  <Bar dataKey="percentage" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Node Distribution Pie Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text-primary">
                Concept Mastery Distribution
              </h3>
              <span className="text-xs text-text-muted">All active nodes</span>
            </div>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nodeStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {nodeStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#172033', borderColor: '#1E293B', borderRadius: '8px', color: '#F8FAFC' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 pr-6">
                {nodeStatusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-text-secondary">{item.name}:</span>
                    <span className="font-semibold text-text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quiz Performance History Chart */}
          {quizPerformanceData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-text-primary">
                  Recent Assessment Scores (%)
                </h3>
                <span className="text-xs text-text-muted">Target Pass: 75%</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quizPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="quizNumber" stroke="#64748B" />
                    <YAxis domain={[0, 100]} stroke="#64748B" />
                    <Tooltip
                      contentStyle={{ background: '#172033', borderColor: '#1E293B', borderRadius: '8px', color: '#F8FAFC' }}
                      formatter={(val: number, _, item) => [`${val}%`, item.payload.concept]}
                    />
                    <Bar dataKey="score" fill="#22D3EE" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Remediation & Weak Concepts Identification */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-text-primary">
                Identified Knowledge Gaps
              </h3>
              <AlertCircle className="h-4 w-4 text-warning" />
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Concepts most frequently missed across assessment attempts, targeted for adaptive remediation.
            </p>
            {weakTopics.length > 0 ? (
              <div className="space-y-2.5">
                {weakTopics.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-dark-primary border border-dark-elevated text-xs"
                  >
                    <span className="font-medium text-text-primary">{item.concept}</span>
                    <span className="badge bg-danger/10 text-danger font-semibold">
                      Missed {item.count}x
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic py-6 text-center">
                No recurring knowledge gaps identified. Excellent conceptual grasp!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Research Integrity & Data Provenance Notice */}
      <div className="card bg-dark-secondary/60 border-dark-elevated">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-accent-cyan shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary space-y-1">
            <p className="font-semibold text-text-primary">Research Data Provenance & Grounding</p>
            <p>
              Skill tree progress and node states are synchronized live with the backend SQLite database (
              <code className="text-accent-cyan">GET /trees/{'{tree_id}'}</code>). Quiz scores and added nodes reflect real outputs from the Bayesian Knowledge Tracing engine (
              <code className="text-accent-cyan">knowledge_tracer.py</code>). XP, streaks, and local levels are tracked client-side via versioned browser storage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
