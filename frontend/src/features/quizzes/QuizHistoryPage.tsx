import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, CheckCircle2, AlertTriangle, GitFork } from 'lucide-react';
import { useQuizHistory } from '@/hooks/useQuizQueries';
import { LoadingSpinner, EmptyState, ErrorMessage, Badge } from '@/components/ui';
import { cn, formatPercent, formatDate } from '@/lib/utils';

export default function QuizHistoryPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const navigate = useNavigate();
  const { data: history, isLoading, error } = useQuizHistory(treeId);

  if (isLoading)
    return <LoadingSpinner size="lg" label="Loading quiz attempts..." className="min-h-[60vh]" />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to Tree
        </button>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Assessment History</h2>
          <p className="text-sm text-text-secondary">{history?.length || 0} quizzes logged</p>
        </div>
      </div>

      {history && history.length > 0 ? (
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.quiz_id} className="card-hover">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                    item.score >= 0.75 ? 'bg-success/10' : 'bg-warning/10'
                  )}
                >
                  {item.score >= 0.75 ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary">{item.title || item.node_id}</h3>
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">
                      Score: {formatPercent(item.score)}
                    </span>
                    <span>·</span>
                    <span>{formatDate(item.submitted_at)}</span>
                  </div>
                </div>
                <Badge variant={item.score >= 0.75 ? 'success' : 'warning'}>
                  {item.score >= 0.75 ? 'Passed' : 'Needs Review'}
                </Badge>
              </div>
              {item.missed_concepts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dark-elevated">
                  <p className="text-xs text-text-muted mb-1.5 font-medium">Missed Concepts:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.missed_concepts.map((c, i) => (
                      <Badge key={i} variant="danger" className="text-[10px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {item.added_nodes.length > 0 && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-text-muted">
                  <GitFork className="h-3.5 w-3.5 text-accent-purple" />
                  <span>
                    Spawned {item.added_nodes.length} adaptive concept
                    {item.added_nodes.length > 1 ? 's' : ''} in DAG
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Brain}
          title="No quizzes taken yet"
          description="Complete concept quizzes in your skill tree to view your performance history and analytics here."
          action={
            <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-primary">
              Return to Skill Tree
            </button>
          }
        />
      )}
    </div>
  );
}
