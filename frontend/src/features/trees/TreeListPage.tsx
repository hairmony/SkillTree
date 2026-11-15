import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  GitFork,
  Trash2,
  ArrowRight,
  BookOpen,
  Search,
  History,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useTreeList, useDeleteTree } from '@/hooks/useTreeQueries';
import { useQuery } from '@tanstack/react-query';
import { treesApi } from '@/api';
import { EmptyState, ErrorMessage, ProgressBar, SkeletonCard, ConfirmDialog, Badge } from '@/components/ui';
import { formatPercent } from '@/lib/utils';
import { toast } from 'sonner';

function TreeCard({ id, title }: { id: string; title: string }) {
  const navigate = useNavigate();
  const deleteTree = useDeleteTree();
  const [showDelete, setShowDelete] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ['trees', 'detail', id],
    queryFn: () => treesApi.get(id),
    staleTime: 30_000,
  });

  const mastered = detail?.nodes.filter((n) => n.status === 'mastered').length ?? 0;
  const total = detail?.nodes.length ?? 0;
  const progress = total > 0 ? mastered / total : 0;
  const unlocked = detail?.nodes.filter((n) => n.status === 'unlocked').length ?? 0;
  const nextUnlockedNode = detail?.nodes.find((n) => n.status === 'unlocked');

  // Derive status badge
  const statusConfig = useMemo(() => {
    if (total === 0) return { label: 'Empty Pathway', variant: 'default' as const };
    if (mastered === total) return { label: 'Completed', variant: 'success' as const };
    if (mastered > 0) return { label: `In Progress (${formatPercent(progress)})`, variant: 'cyan' as const };
    return { label: 'Ready to Start', variant: 'purple' as const };
  }, [total, mastered, progress]);

  return (
    <>
      <div className="card-hover group flex flex-col justify-between">
        <div>
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-accent-purple/10 flex items-center justify-center shrink-0">
                <GitFork className="h-5 w-5 text-accent-purple" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-text-primary text-base truncate">{title}</h3>
                <span className="text-xs text-text-muted truncate block">{id}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDelete(true);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-all shrink-0"
              aria-label={`Delete ${title}`}
              title="Delete skill tree"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Status Badge & Metrics */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <Badge variant={statusConfig.variant} className="text-xs font-medium">
              {statusConfig.label}
            </Badge>
            <span className="text-xs text-text-secondary font-medium">
              {mastered} / {total} concepts
            </span>
          </div>

          <ProgressBar
            value={progress}
            size="sm"
            color={mastered === total && total > 0 ? 'green' : 'purple'}
            className="mb-4"
          />

          {/* Stats Breakdown Grid */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-dark-primary border border-dark-elevated text-center mb-4">
            <div>
              <p className="text-xs text-text-muted">Mastered</p>
              <p className="text-sm font-bold text-success">{mastered}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Available</p>
              <p className="text-sm font-bold text-accent-purple">{unlocked}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total</p>
              <p className="text-sm font-bold text-text-primary">{total}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-dark-elevated/60">
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/trees/${id}`)}
              className="btn-secondary flex-1 text-xs py-2"
              title="Inspect interactive DAG graph"
            >
              <GitFork className="h-3.5 w-3.5" />
              View DAG Map
            </button>

            {nextUnlockedNode ? (
              <button
                onClick={() => navigate(`/trees/${id}/learn/${nextUnlockedNode.id}`)}
                className="btn-primary flex-1 text-xs py-2"
                title={`Continue directly with ${nextUnlockedNode.title}`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {progress > 0 ? 'Continue' : 'Start'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => navigate(`/trees/${id}`)}
                className="btn-primary flex-1 text-xs py-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Review
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
            <Link
              to={`/trees/${id}/quizzes`}
              className="flex items-center gap-1 hover:text-accent-cyan transition-colors"
            >
              <History className="h-3 w-3" />
              Quiz History
            </Link>
            {nextUnlockedNode && (
              <span className="truncate max-w-[150px]" title={`Next: ${nextUnlockedNode.title}`}>
                Next: {nextUnlockedNode.title}
              </span>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          deleteTree.mutate(id, {
            onSuccess: () => {
              toast.success(`"${title}" deleted`);
              setShowDelete(false);
            },
            onError: (e) => toast.error((e as Error).message),
          });
        }}
        title={`Delete "${title}"?`}
        message="This will permanently delete this skill tree, all associated progress, chunks, and quiz history. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteTree.isPending}
      />
    </>
  );
}

export default function TreeListPage() {
  const { data: trees, isLoading, error, refetch } = useTreeList();
  const [searchFilter, setSearchFilter] = useState('');

  const filteredTrees = useMemo(() => {
    if (!trees) return [];
    if (!searchFilter.trim()) return trees;
    const q = searchFilter.toLowerCase();
    return trees.filter(
      (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [trees, searchFilter]);

  if (error) {
    return <ErrorMessage message={(error as Error).message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">My Skill Trees</h2>
          <p className="text-sm text-text-secondary mt-1">
            Your personalized learning pathways synthesized from multimodal academic sources
          </p>
        </div>
        <Link to="/trees/create" className="btn-primary shrink-0">
          <Plus className="h-4 w-4" />
          Create Skill Tree
        </Link>
      </div>

      {/* Filter and Search Bar */}
      {trees && trees.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-3 text-text-muted" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search skill trees by topic..."
              className="input-field pl-9 text-sm"
            />
          </div>
          <span className="text-xs text-text-muted hidden sm:inline">
            Showing {filteredTrees.length} of {trees.length} trees
          </span>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : filteredTrees.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTrees.map((tree) => (
            <TreeCard key={tree.id} id={tree.id} title={tree.title} />
          ))}
        </div>
      ) : trees && trees.length > 0 ? (
        <EmptyState
          icon={Search}
          title="No matching skill trees"
          description={`No skill trees match "${searchFilter}". Clear the filter to view all pathways.`}
          action={
            <button onClick={() => setSearchFilter('')} className="btn-secondary">
              Clear Search
            </button>
          }
        />
      ) : (
        <EmptyState
          icon={GitFork}
          title="No skill trees yet"
          description="Create your first skill tree to generate an adaptive DAG learning pathway."
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
