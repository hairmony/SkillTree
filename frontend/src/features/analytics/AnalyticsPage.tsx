import { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import { BarChart3, TrendingUp, CheckCircle2, Brain, AlertCircle, ArrowRight } from 'lucide-react';
import { useTreeList } from '@/hooks/useTreeQueries';
import { treesApi, quizzesApi } from '@/api';
import { useGamificationStore } from '@/stores';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/components/ui';
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
      const combined: (QuizHistoryItem & { treeTitle: string; treeId: string })[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          const title = trees?.[i]?.title || treeIds[i];
          const tId = treeIds[i];
          r.value.forEach((q) => combined.push({ ...q, treeTitle: title, treeId: tId }));
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

  const knowledgeGaps = useMemo(() => {
    if (!allQuizzes || allQuizzes.length === 0) return [];

    const gapsMap = new Map<
      string,
      {
        concept: string;
        treeId?: string;
        nodeId?: string;
        scores: number[];
        count: number;
      }
    >();

    allQuizzes.forEach((q) => {
      const isLowScore = q.score < 0.75;
      const hasMissed = Array.isArray(q.missed_concepts) && q.missed_concepts.length > 0;

      // 1. Process specific missed concepts from questions
      if (hasMissed) {
        q.missed_concepts.forEach((concept) => {
          if (!concept || !concept.trim()) return;
          const trimmed = concept.trim();
          const existing = gapsMap.get(trimmed);
          if (existing) {
            existing.count += 1;
            existing.scores.push(Math.round(q.score * 100));
            if (!existing.treeId && q.treeId) existing.treeId = q.treeId;
            if (!existing.nodeId && q.node_id) existing.nodeId = q.node_id;
          } else {
            gapsMap.set(trimmed, {
              concept: trimmed,
              treeId: q.treeId,
              nodeId: q.node_id,
              scores: [Math.round(q.score * 100)],
              count: 1,
            });
          }
        });
      }

      // 2. If quiz scored below 75% and its concept is not already captured
      if (isLowScore) {
        const conceptName = (q.title && q.title.trim()) || q.node_id;
        if (conceptName && !gapsMap.has(conceptName)) {
          gapsMap.set(conceptName, {
            concept: conceptName,
            treeId: q.treeId,
            nodeId: q.node_id,
            scores: [Math.round(q.score * 100)],
            count: 1,
          });
        }
      }
    });

    return Array.from(gapsMap.values())
      .map((item) => ({
        concept: item.concept,
        treeId: item.treeId,
        nodeId: item.nodeId,
        score:
          item.scores.length > 0
            ? Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length)
            : undefined,
        count: item.count,
      }))
      .sort((a, b) => b.count - a.count || (a.score ?? 100) - (b.score ?? 100))
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
              Concepts identified from assessment attempts that need further review.
            </p>

            {/* Condition 1 — No quizzes completed */}
            {!allQuizzes || allQuizzes.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-dark-elevated rounded-lg bg-dark-secondary/30">
                <p className="text-sm text-text-muted">
                  Complete a quiz to identify areas for improvement.
                </p>
              </div>
            ) : knowledgeGaps.length === 0 ? (
              /* Condition 2 — Quizzes completed, no knowledge gaps */
              <div className="py-8 text-center border border-dashed border-dark-elevated rounded-lg bg-dark-secondary/30">
                <p className="text-sm text-text-muted">
                  No areas for improvement identified yet.
                </p>
              </div>
            ) : (
              /* Condition 3 — Knowledge gaps detected */
              <div className="space-y-2.5">
                {knowledgeGaps.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-dark-primary border border-dark-elevated gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-text-primary truncate">
                        {item.concept}
                      </span>
                      <span className="badge bg-warning/10 text-warning font-medium text-[11px] shrink-0">
                        Needs Review
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                      {item.score !== undefined && (
                        <span className="text-text-muted">
                          Score:{' '}
                          <span
                            className={
                              item.score < 75
                                ? 'text-danger font-semibold'
                                : 'text-text-secondary font-medium'
                            }
                          >
                            {item.score}%
                          </span>
                        </span>
                      )}
                      {item.count > 1 && (
                        <span className="badge bg-danger/10 text-danger font-semibold">
                          Missed {item.count}x
                        </span>
                      )}
                      {item.treeId && item.nodeId ? (
                        <Link
                          to={`/trees/${item.treeId}/learn/${item.nodeId}`}
                          className="text-accent-purple hover:text-accent-purple/80 font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          Review Concept
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : item.treeId ? (
                        <Link
                          to={`/trees/${item.treeId}`}
                          className="text-accent-purple hover:text-accent-purple/80 font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          View Tree
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
