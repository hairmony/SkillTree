import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  FileText,
  Video,
  Globe,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  GitFork,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useNodeContent } from '@/hooks/useContentQueries';
import { useTree, useMarkMastered } from '@/hooks/useTreeQueries';
import { useGamificationStore } from '@/stores';
import { LoadingSpinner, ErrorMessage, Badge, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ContentSource, TreeNode } from '@/types';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded bg-dark-elevated/80 hover:bg-dark-elevated text-text-muted hover:text-text-primary transition-colors"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const sourceTypeIcons: Record<string, React.ElementType> = {
  video: Video,
  paper: FileText,
  wikipedia: GraduationCap,
  wikibooks: BookOpen,
  web: Globe,
  text: FileText,
};

function SourceCard({ source }: { source: ContentSource }) {
  const Icon = sourceTypeIcons[source.type] || Globe;
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-dark-primary border border-dark-elevated transition-colors hover:border-accent-purple/30">
      <div className="h-9 w-9 rounded-lg bg-dark-elevated flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-accent-cyan" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant={
              source.type === 'video'
                ? 'danger'
                : source.type === 'paper'
                ? 'purple'
                : source.type === 'wikipedia'
                ? 'cyan'
                : 'default'
            }
            className="text-[10px]"
          >
            {source.type}
          </Badge>
        </div>
        <p className="text-sm font-medium text-text-primary truncate" title={source.title}>
          {source.title}
        </p>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-cyan hover:underline inline-flex items-center gap-1 mt-1 font-medium"
          >
            <span>{source.type === 'video' ? 'Watch Video at Timestamp' : 'View Source Document'}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-xs text-text-muted mt-0.5 truncate">{source.source}</p>
        )}
      </div>
    </div>
  );
}

export default function LessonPage() {
  const { treeId, nodeId } = useParams<{ treeId: string; nodeId: string }>();
  const navigate = useNavigate();
  const { data: content, isLoading, error } = useNodeContent(treeId, nodeId);
  const { data: tree } = useTree(treeId);
  const markMastered = useMarkMastered();
  const recordLessonCompleted = useGamificationStore((s) => s.recordLessonCompleted);
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set([0])); // First example open by default

  const nodes = useMemo(() => tree?.nodes || [], [tree?.nodes]);
  const currentIndex = nodes.findIndex((n) => n.id === nodeId);
  const currentNode = currentIndex >= 0 ? nodes[currentIndex] : null;

  const prevNode = currentIndex > 0 ? nodes[currentIndex - 1] : null;
  const nextNode = currentIndex >= 0 && currentIndex < nodes.length - 1 ? nodes[currentIndex + 1] : null;

  const incomingPrereqIds = useMemo(
    () => (tree?.edges.filter((e) => e.child_id === nodeId) || []).map((e) => e.parent_id),
    [tree?.edges, nodeId]
  );
  const prerequisites = useMemo(
    () =>
      incomingPrereqIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is TreeNode => Boolean(n)),
    [incomingPrereqIds, nodes]
  );

  const handleMarkComplete = () => {
    if (!treeId || !nodeId) return;
    markMastered.mutate(
      { treeId, nodeId },
      {
        onSuccess: () => {
          recordLessonCompleted(treeId, nodeId);
          toast.success('Concept marked as complete! XP awarded.');
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <LoadingSpinner size="lg" label="Retrieving and preparing lesson content..." />
        <p className="text-xs text-text-muted">
          Grounding explanations in retrieved multimodal chunks and RAG index...
        </p>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={(error as Error).message} onRetry={() => window.location.reload()} />;
  }

  if (!content) {
    return <ErrorMessage message="No content available for this concept" />;
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto pb-12">
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary border-b border-dark-elevated pb-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/trees/${treeId}`}
            className="flex items-center gap-1.5 text-text-muted hover:text-accent-purple transition-colors font-medium"
          >
            <GitFork className="h-3.5 w-3.5" />
            <span>{treeId?.replace(/-/g, ' ')}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-text-primary font-semibold">{currentNode?.title || nodeId}</span>
        </div>

        <div className="flex items-center gap-3">
          {currentIndex >= 0 && (
            <span className="text-text-muted">
              Concept {currentIndex + 1} of {nodes.length}
            </span>
          )}
          <Link
            to={`/trees/${treeId}`}
            className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Tree Map
          </Link>
        </div>
      </div>

      {/* Main Concept Header Card */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  currentNode?.status === 'mastered'
                    ? 'success'
                    : currentNode?.status === 'unlocked'
                    ? 'purple'
                    : 'default'
                }
              >
                {currentNode?.status === 'mastered'
                  ? 'Mastered'
                  : currentNode?.status === 'unlocked'
                  ? 'Unlocked & Available'
                  : 'Locked'}
              </Badge>

              {currentNode?.kind !== 'core' && (
                <Badge
                  variant={currentNode?.kind === 'required' ? 'danger' : 'warning'}
                  className="font-semibold"
                >
                  {currentNode?.kind === 'required' ? 'Remediation Review Concept' : 'Optional Deep Dive'}
                </Badge>
              )}

              {currentNode?.mastery !== undefined && currentNode.mastery > 0 && (
                <Badge variant="cyan">BKT Mastery: {Math.round(currentNode.mastery * 100)}%</Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              {currentNode?.title || nodeId}
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">{currentNode?.description}</p>
          </div>

          <div className="flex sm:flex-col gap-2 shrink-0">
            <Link
              to={`/trees/${treeId}/quiz/${nodeId}`}
              className="btn-primary text-sm flex items-center justify-center gap-2 py-2.5 px-4 shadow-lg shadow-accent-purple/10"
            >
              <Brain className="h-4 w-4" />
              <span>Take Quiz</span>
            </Link>

            {currentNode?.status !== 'mastered' && (
              <button
                onClick={handleMarkComplete}
                className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2 px-3"
                disabled={markMastered.isPending}
                title="Mark completed without taking quiz"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Mark as Studied</span>
              </button>
            )}
          </div>
        </div>

        {/* Remediation Note if Required */}
        {currentNode?.kind === 'required' && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-text-secondary">
            <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-danger">Adaptive Remediation Review</p>
              <p className="mt-0.5">
                This concept was dynamically inserted into your learning tree by the adaptive Bayesian Knowledge Tracing engine to reinforce topics missed during your recent quiz attempt.
              </p>
            </div>
          </div>
        )}

        {/* Prerequisites Summary */}
        {prerequisites.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dark-elevated text-xs">
            <span className="text-text-muted font-medium">Prerequisites:</span>
            {prerequisites.map((prereq) => (
              <Link
                key={prereq.id}
                to={`/trees/${treeId}/learn/${prereq.id}`}
                className="badge bg-dark-elevated hover:bg-dark-primary text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
              >
                {prereq.status === 'mastered' && <CheckCircle2 className="h-3 w-3 text-success" />}
                <span>{prereq.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Target Objectives Section */}
      {currentNode?.objectives && currentNode.objectives.length > 0 && (
        <div className="card">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Learning Objectives
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {currentNode.objectives.map((obj, i) => (
              <li
                key={i}
                className="text-xs text-text-secondary flex items-start gap-2 p-2 rounded-lg bg-dark-primary border border-dark-elevated/60"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-accent-purple shrink-0" />
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lesson Details (Markdown formatted explanation) */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-text-primary border-b border-dark-elevated pb-3">
          Concept Overview & Technical Details
        </h3>
        <div className="prose prose-invert max-w-none text-text-secondary text-sm leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p({ children }) {
                return <p className="mb-4 leading-relaxed text-text-secondary text-sm">{children}</p>;
              },
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeStr = String(children).replace(/\n$/, '');
                if (match) {
                  return (
                    <div className="relative group not-prose my-4">
                      <CopyButton text={codeStr} />
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          background: '#0B1020',
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          fontSize: '0.85rem',
                          border: '1px solid #1E293B',
                        }}
                      >
                        {codeStr}
                      </SyntaxHighlighter>
                    </div>
                  );
                }
                return (
                  <code
                    className={cn(
                      'bg-dark-primary px-1.5 py-0.5 rounded text-accent-cyan text-xs font-mono border border-dark-elevated',
                      className
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full text-left border-collapse border border-dark-elevated text-xs">
                      {children}
                    </table>
                  </div>
                );
              },
            }}
          >
            {content.details}
          </ReactMarkdown>
        </div>
      </div>

      {/* Worked Examples (Interactive Accordion) */}
      {content.examples && content.examples.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-dark-elevated pb-3">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Worked Examples</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Concrete step-by-step applications demonstrating this concept
              </p>
            </div>
            <span className="text-xs text-text-muted">{content.examples.length} examples</span>
          </div>

          <div className="space-y-3">
            {content.examples.map((example, i) => {
              const isOpen = expandedExamples.has(i);
              return (
                <div key={i} className="rounded-xl bg-dark-primary border border-dark-elevated overflow-hidden transition-all">
                  <button
                    onClick={() => {
                      const next = new Set(expandedExamples);
                      if (isOpen) next.delete(i);
                      else next.add(i);
                      setExpandedExamples(next);
                    }}
                    className="flex items-center justify-between w-full p-4 text-left font-medium text-sm text-text-primary hover:bg-dark-elevated/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-md bg-accent-purple/10 text-accent-purple flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <span>Example {i + 1}</span>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-accent-purple" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-text-muted" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-1 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed border-t border-dark-elevated/50 bg-dark-card/30">
                      {example}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cited Grounding Sources & Multimedia */}
      {content.sources && content.sources.length > 0 && (
        <div className="card space-y-4">
          <div className="border-b border-dark-elevated pb-3">
            <h3 className="text-base font-semibold text-text-primary">Academic Grounding & Cited Sources</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Verified sources retrieved via RAG and referenced during the AI generation of this lesson
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {content.sources.map((source, i) => (
              <SourceCard key={i} source={source} />
            ))}
          </div>
        </div>
      )}

      {/* Curriculum Traversal Navigation Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-dark-elevated">
        {prevNode ? (
          <Link
            to={`/trees/${treeId}/learn/${prevNode.id}`}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2.5 px-3.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <div className="text-left">
              <span className="block text-[10px] text-text-muted">Previous Concept</span>
              <span className="font-semibold text-text-primary truncate max-w-[140px] block">
                {prevNode.title}
              </span>
            </div>
          </Link>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Link to={`/trees/${treeId}`} className="btn-secondary text-xs py-2.5 px-3">
            <GitFork className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">View Tree Map</span>
          </Link>

          <Link
            to={`/trees/${treeId}/quiz/${nodeId}`}
            className="btn-primary text-xs flex items-center gap-1.5 py-2.5 px-4 font-semibold"
          >
            <Brain className="h-3.5 w-3.5" />
            <span>Assess Concept (Quiz)</span>
          </Link>
        </div>

        {nextNode ? (
          <Link
            to={`/trees/${treeId}/learn/${nextNode.id}`}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2.5 px-3.5"
          >
            <div className="text-right">
              <span className="block text-[10px] text-text-muted">Next Concept</span>
              <span className="font-semibold text-text-primary truncate max-w-[140px] block">
                {nextNode.title}
              </span>
            </div>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
