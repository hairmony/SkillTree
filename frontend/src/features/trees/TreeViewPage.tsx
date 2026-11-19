import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
  type Edge as FlowEdge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Lock,
  CheckCircle2,
  Circle,
  RotateCcw,
  History,
  X,
  ChevronRight,
} from 'lucide-react';
import { useTree, useResetTree } from '@/hooks/useTreeQueries';
import { LoadingSpinner, ErrorMessage, ProgressBar, Badge, ConfirmDialog } from '@/components/ui';
import { cn, formatPercent } from '@/lib/utils';
import { toast } from 'sonner';
import type { TreeNode, TreeEdge } from '@/types';

function SkillNodeComponent({ data, selected }: NodeProps) {
  const node = (data as unknown) as TreeNode & { onSelect: (id: string) => void; isSelected?: boolean };
  const isLocked = node.status === 'locked';
  const isMastered = node.status === 'mastered';
  const isUnlocked = node.status === 'unlocked';
  const isSelected = Boolean(selected || node.isSelected);

  const bgColor = isMastered
    ? 'bg-success/20 border-success/50'
    : isUnlocked
    ? 'bg-accent-purple/20 border-accent-purple/50'
    : 'bg-dark-elevated/80 border-dark-elevated';

  const statusIcon = isMastered ? (
    <CheckCircle2 className="h-4 w-4 text-success" />
  ) : isUnlocked ? (
    <Circle className="h-4 w-4 text-accent-purple" />
  ) : (
    <Lock className="h-4 w-4 text-text-muted" />
  );

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 min-w-[160px] max-w-[220px]',
        bgColor,
        isLocked ? 'opacity-75 hover:opacity-100 hover:border-text-muted' : 'hover:shadow-lg hover:shadow-accent-purple/10',
        isSelected && 'ring-2 ring-accent-cyan shadow-lg shadow-accent-cyan/25 scale-[1.02] border-accent-cyan',
        node.kind === 'required' && !isSelected && 'border-danger/70 shadow-danger/10',
        node.kind === 'optional' && !isSelected && 'border-dashed border-warning/70'
      )}
      onClick={() => node.onSelect(node.id)}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent-purple !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        {statusIcon}
        <span className="text-xs font-medium text-text-secondary truncate">
          {node.kind !== 'core' && (
            <Badge
              variant={node.kind === 'required' ? 'danger' : 'warning'}
              className="mr-1 text-[10px]"
            >
              {node.kind}
            </Badge>
          )}
          {isMastered ? 'Mastered' : isUnlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>
      <h4
        className={cn(
          'text-sm font-semibold truncate',
          isLocked ? 'text-text-muted' : 'text-text-primary'
        )}
      >
        {node.title}
      </h4>
      {node.mastery > 0 && (
        <div className="mt-2">
          <ProgressBar value={node.mastery} size="sm" color={isMastered ? 'green' : 'purple'} />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-accent-purple !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { skillNode: SkillNodeComponent };

function layoutDAG(nodes: TreeNode[], edges: TreeEdge[]): { x: number; y: number; id: string }[] {
  const children: Record<string, string[]> = {};
  const parents: Record<string, string[]> = {};
  nodes.forEach((n) => {
    children[n.id] = [];
    parents[n.id] = [];
  });
  edges.forEach((e) => {
    children[e.parent_id]?.push(e.child_id);
    parents[e.child_id]?.push(e.parent_id);
  });

  const layers: Record<string, number> = {};
  const roots = nodes.filter((n) => parents[n.id].length === 0);
  const queue = roots.map((r) => ({ id: r.id, layer: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    if (visited.has(id)) {
      layers[id] = Math.max(layers[id] ?? 0, layer);
      continue;
    }
    visited.add(id);
    layers[id] = Math.max(layers[id] ?? 0, layer);
    for (const child of children[id] ?? []) {
      queue.push({ id: child, layer: layer + 1 });
    }
  }
  nodes.forEach((n) => {
    if (!(n.id in layers)) layers[n.id] = 0;
  });

  const layerGroups: Record<number, string[]> = {};
  Object.entries(layers).forEach(([id, layer]) => {
    if (!layerGroups[layer]) layerGroups[layer] = [];
    layerGroups[layer].push(id);
  });

  const NODE_WIDTH = 250;
  const NODE_HEIGHT = 140;

  return nodes.map((n) => {
    const layer = layers[n.id];
    const group = layerGroups[layer];
    const index = group.indexOf(n.id);
    const totalInLayer = group.length;
    const startX = (-(totalInLayer - 1) * NODE_WIDTH) / 2;

    return {
      id: n.id,
      x: startX + index * NODE_WIDTH,
      y: layer * NODE_HEIGHT,
    };
  });
}

function NodeDetailPanel({
  node,
  treeId,
  allNodes,
  edges,
  onSelectNode,
  onClose,
}: {
  node: TreeNode;
  treeId: string;
  allNodes: TreeNode[];
  edges: TreeEdge[];
  onSelectNode: (id: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  // Compute incoming prerequisites (edges pointing to this node)
  const incomingPrereqIds = useMemo(
    () => edges.filter((e) => e.child_id === node.id).map((e) => e.parent_id),
    [edges, node.id]
  );
  const prerequisites = useMemo(
    () =>
      incomingPrereqIds
        .map((id) => allNodes.find((n) => n.id === id))
        .filter((n): n is TreeNode => Boolean(n)),
    [incomingPrereqIds, allNodes]
  );

  // Compute dependent concepts (edges pointing out from this node)
  const outgoingChildIds = useMemo(
    () => edges.filter((e) => e.parent_id === node.id).map((e) => e.child_id),
    [edges, node.id]
  );
  const dependentConcepts = useMemo(
    () =>
      outgoingChildIds
        .map((id) => allNodes.find((n) => n.id === id))
        .filter((n): n is TreeNode => Boolean(n)),
    [outgoingChildIds, allNodes]
  );

  const firstIncompletePrereq = useMemo(
    () => prerequisites.find((p) => p.status !== 'mastered'),
    [prerequisites]
  );

  return (
    <div className="w-80 sm:w-96 bg-dark-secondary border-l border-dark-elevated p-5 overflow-y-auto flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-dark-elevated">
          <h3 className="text-base font-semibold text-text-primary">Concept Details</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-elevated text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant={
                node.status === 'mastered'
                  ? 'success'
                  : node.status === 'unlocked'
                  ? 'purple'
                  : 'default'
              }
            >
              {node.status === 'mastered'
                ? 'Mastered'
                : node.status === 'unlocked'
                ? 'Available'
                : 'Locked'}
            </Badge>
            {node.kind !== 'core' && (
              <Badge variant={node.kind === 'required' ? 'danger' : 'warning'}>
                {node.kind}
              </Badge>
            )}
          </div>
          <h4 className="text-lg font-bold text-text-primary">{node.title}</h4>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed">{node.description}</p>
        </div>

        {node.mastery > 0 && (
          <div className="p-3 rounded-lg bg-dark-card border border-dark-elevated">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-text-secondary">Bayesian Mastery Score</span>
              <span className="font-bold text-text-primary">{Math.round(node.mastery * 100)}%</span>
            </div>
            <ProgressBar
              value={node.mastery}
              size="sm"
              color={node.mastery >= 0.75 ? 'green' : 'purple'}
            />
          </div>
        )}

        {/* Locked Explanation & Prerequisites */}
        {node.status === 'locked' && (
          <div className="rounded-xl bg-dark-card border border-warning/30 p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-warning text-xs font-semibold">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Prerequisites Required</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              To unlock this concept, you must achieve passing mastery (≥75%) on the prerequisite concepts below:
            </p>

            <div className="space-y-1.5">
              {prerequisites.map((prereq) => (
                <button
                  key={prereq.id}
                  onClick={() => onSelectNode(prereq.id)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-dark-elevated hover:bg-dark-elevated/80 text-left transition-colors text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {prereq.status === 'mastered' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    )}
                    <span className="font-medium text-text-primary truncate group-hover:text-accent-cyan">
                      {prereq.title}
                    </span>
                  </div>
                  <Badge
                    variant={
                      prereq.status === 'mastered'
                        ? 'success'
                        : prereq.status === 'unlocked'
                        ? 'purple'
                        : 'default'
                    }
                    className="text-[10px] shrink-0 ml-2"
                  >
                    {prereq.status === 'mastered'
                      ? 'Mastered'
                      : prereq.status === 'unlocked'
                      ? 'Available'
                      : 'Locked'}
                  </Badge>
                </button>
              ))}

              {prerequisites.length === 0 && (
                <p className="text-xs text-text-muted italic">
                  Root concept or dependent on predecessor pathway.
                </p>
              )}
            </div>

            {firstIncompletePrereq && (
              <button
                onClick={() => {
                  if (firstIncompletePrereq.status === 'unlocked') {
                    navigate(`/trees/${treeId}/learn/${firstIncompletePrereq.id}`);
                  } else {
                    onSelectNode(firstIncompletePrereq.id);
                  }
                }}
                className="btn-secondary w-full text-xs py-2 mt-2"
              >
                {firstIncompletePrereq.status === 'unlocked' ? (
                  <>
                    <BookOpen className="h-3.5 w-3.5 text-accent-purple" />
                    Study {firstIncompletePrereq.title}
                  </>
                ) : (
                  <>Inspect {firstIncompletePrereq.title}</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Learning Objectives */}
        {node.objectives.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              Learning Objectives
            </h5>
            <ul className="space-y-1.5">
              {node.objectives.map((obj, i) => (
                <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                  <ChevronRight className="h-3 w-3 mt-0.5 text-accent-purple shrink-0" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dependent Concepts (Unlocks Next) */}
        {dependentConcepts.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              Unlocks After Mastery
            </h5>
            <div className="space-y-1">
              {dependentConcepts.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onSelectNode(child.id)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-dark-card/60 hover:bg-dark-elevated text-left transition-colors text-xs"
                >
                  <span className="text-text-primary truncate">{child.title}</span>
                  <Badge variant="default" className="text-[10px]">
                    {child.status}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-dark-elevated mt-4 space-y-2">
        {node.status === 'unlocked' && (
          <>
            <button
              onClick={() => navigate(`/trees/${treeId}/learn/${node.id}`)}
              className="btn-primary w-full"
            >
              <BookOpen className="h-4 w-4" /> Start Lesson
            </button>
            <button
              onClick={() => navigate(`/trees/${treeId}/quiz/${node.id}`)}
              className="btn-secondary w-full"
            >
              <Brain className="h-4 w-4" /> Take Quiz
            </button>
          </>
        )}

        {node.status === 'mastered' && (
          <>
            <button
              onClick={() => navigate(`/trees/${treeId}/learn/${node.id}`)}
              className="btn-secondary w-full"
            >
              <BookOpen className="h-4 w-4" /> Review Lesson
            </button>
            <button
              onClick={() => navigate(`/trees/${treeId}/quiz/${node.id}`)}
              className="btn-secondary w-full"
            >
              <Brain className="h-4 w-4" /> Retake Quiz
            </button>
            <button
              onClick={() => navigate(`/trees/${treeId}/quizzes`)}
              className="btn-ghost w-full text-xs text-text-muted hover:text-text-primary"
            >
              <History className="h-3.5 w-3.5" /> View Quiz History
            </button>
          </>
        )}

        {node.status === 'locked' && (
          <div className="text-center py-2 text-xs text-text-muted flex items-center justify-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-warning" />
            <span>Complete prerequisites to access this concept</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TreeViewPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const navigate = useNavigate();
  const { data: tree, isLoading, error, refetch } = useTree(treeId);
  const resetTree = useResetTree();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const selectedNode = useMemo(
    () => tree?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [tree, selectedNodeId]
  );

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!tree) return { flowNodes: [], flowEdges: [] };

    const positions = layoutDAG(tree.nodes, tree.edges);
    const posMap: Record<string, { x: number; y: number }> = {};
    positions.forEach((p) => {
      posMap[p.id] = { x: p.x, y: p.y };
    });

    const flowNodes: FlowNode[] = tree.nodes.map((n) => ({
      id: n.id,
      type: 'skillNode',
      position: posMap[n.id] || { x: 0, y: 0 },
      data: { ...n, onSelect: setSelectedNodeId, isSelected: n.id === selectedNodeId },
      selected: n.id === selectedNodeId,
    }));

    const nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));
    const flowEdges: FlowEdge[] = tree.edges.map((e) => {
      const childNode = nodeMap.get(e.child_id);
      return {
        id: `${e.parent_id}-${e.child_id}`,
        source: e.parent_id,
        target: e.child_id,
        type: 'smoothstep',
        animated: childNode?.status === 'unlocked',
        style: {
          stroke:
            childNode?.kind === 'optional'
              ? '#F59E0B'
              : childNode?.kind === 'required'
              ? '#EF4444'
              : '#8B5CF6',
          strokeWidth: 2,
          strokeDasharray: childNode?.kind === 'optional' ? '5 5' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8B5CF6' },
      };
    });

    return { flowNodes, flowEdges };
  }, [tree, selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const stats = useMemo(() => {
    if (!tree) return null;
    const total = tree.nodes.length;
    const mastered = tree.nodes.filter((n) => n.status === 'mastered').length;
    const unlocked = tree.nodes.filter((n) => n.status === 'unlocked').length;
    const locked = tree.nodes.filter((n) => n.status === 'locked').length;
    return { total, mastered, unlocked, locked, progress: total > 0 ? mastered / total : 0 };
  }, [tree]);

  if (isLoading)
    return <LoadingSpinner size="lg" label="Loading skill tree..." className="min-h-[60vh]" />;
  if (error) return <ErrorMessage message={(error as Error).message} onRetry={() => refetch()} />;
  if (!tree || !treeId) return <ErrorMessage message="Skill tree not found" />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button onClick={() => navigate('/trees')} className="btn-ghost self-start">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary capitalize">{treeId.replace(/-/g, ' ')}</h2>
            {stats && (
              <span className="text-sm text-text-secondary">
                {stats.mastered}/{stats.total} concepts ({formatPercent(stats.progress)})
              </span>
            )}
          </div>
          {stats && <ProgressBar value={stats.progress} size="sm" className="mt-2 max-w-md" />}
        </div>
        <div className="flex gap-2">
          <Link to={`/trees/${treeId}/quizzes`} className="btn-ghost">
            <History className="h-4 w-4" /> Quiz History
          </Link>
          <button onClick={() => setShowReset(true)} className="btn-ghost text-warning">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      {/* Graph Canvas + Detail Panel */}
      <div
        className="flex rounded-xl border border-dark-elevated overflow-hidden"
        style={{ height: 'calc(100vh - 220px)' }}
      >
        <div className="flex-1 bg-dark-primary">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.3}
            maxZoom={2}
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1E293B" gap={20} />
            <Controls className="!bg-dark-card !border-dark-elevated !shadow-xl [&>button]:!bg-dark-card [&>button]:!border-dark-elevated [&>button]:!text-text-secondary [&>button:hover]:!bg-dark-elevated" />
            <MiniMap
              nodeColor={(n) => {
                const status = ((n.data as unknown) as TreeNode)?.status;
                return status === 'mastered'
                  ? '#22C55E'
                  : status === 'unlocked'
                  ? '#8B5CF6'
                  : '#334155';
              }}
              className="!bg-dark-card !border-dark-elevated"
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            treeId={treeId}
            allNodes={tree.nodes}
            edges={tree.edges}
            onSelectNode={setSelectedNodeId}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-success/30 border border-success/50" /> Mastered
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-accent-purple/30 border border-accent-purple/50" />{' '}
          Unlocked
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-dark-elevated border border-dark-elevated" /> Locked
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border-2 border-danger/70" /> Remedial Required
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border-2 border-dashed border-warning/70" /> Optional Branch
        </div>
      </div>

      <ConfirmDialog
        open={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={() => {
          resetTree.mutate(treeId, {
            onSuccess: () => {
              toast.success('Tree progress reset');
              setShowReset(false);
              setSelectedNodeId(null);
            },
            onError: (e) => toast.error((e as Error).message),
          });
        }}
        title="Reset Progress?"
        message="This will reset all your mastery states, quiz attempts, and remove remedial branches for this tree."
        confirmLabel="Reset Progress"
        variant="danger"
        loading={resetTree.isPending}
      />
    </div>
  );
}
