import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ArrowLeft,
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
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useNodeContent } from '@/hooks/useContentQueries';
import { useTree, useMarkMastered } from '@/hooks/useTreeQueries';
import { useGamificationStore, useNotesStore } from '@/stores';
import { LoadingSpinner, ErrorMessage, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ContentSource } from '@/types';

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
    <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-primary border border-dark-elevated">
      <div className="h-8 w-8 rounded-lg bg-dark-elevated flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              source.type === 'video' ? 'danger' : source.type === 'paper' ? 'purple' : 'cyan'
            }
            className="text-[10px]"
          >
            {source.type}
          </Badge>
        </div>
        <p className="text-sm text-text-primary mt-1 truncate">{source.title}</p>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-cyan hover:underline flex items-center gap-1 mt-1"
          >
            Open reference <ExternalLink className="h-3 w-3" />
          </a>
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
  const { addNote, getNotesByNode } = useNotesStore();
  const [newNote, setNewNote] = useState('');
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());

  const node = tree?.nodes.find((n) => n.id === nodeId);
  const notes = treeId && nodeId ? getNotesByNode(treeId, nodeId) : [];

  const handleMarkComplete = () => {
    if (!treeId || !nodeId) return;
    markMastered.mutate(
      { treeId, nodeId },
      {
        onSuccess: () => {
          recordLessonCompleted(treeId, nodeId);
          toast.success('Concept marked as complete!');
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !treeId || !nodeId) return;
    addNote({
      title: `Note on ${node?.title || nodeId}`,
      content: newNote.trim(),
      treeId,
      nodeId,
      treeName: treeId,
      nodeName: node?.title || nodeId,
    });
    setNewNote('');
    toast.success('Note saved to IndexedDB/Storage');
  };

  if (isLoading)
    return <LoadingSpinner size="lg" label="Loading lesson content from RAG..." className="min-h-[60vh]" />;
  if (error)
    return <ErrorMessage message={(error as Error).message} onRetry={() => window.location.reload()} />;
  if (!content) return <ErrorMessage message="No content available for this concept" />;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to Tree
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Title card */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={node?.status === 'mastered' ? 'success' : 'purple'}>
                    {node?.status === 'mastered' ? 'Mastered' : 'In Progress'}
                  </Badge>
                  {node?.kind !== 'core' && (
                    <Badge variant={node?.kind === 'required' ? 'danger' : 'warning'}>
                      {node?.kind}
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-text-primary">{node?.title || nodeId}</h2>
                <p className="text-text-secondary mt-1">{node?.description}</p>
                {node?.objectives && node.objectives.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                      Target Objectives
                    </h4>
                    <ul className="space-y-1">
                      {node.objectives.map((obj, i) => (
                        <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-accent-purple shrink-0" />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleMarkComplete}
                  className="btn-secondary text-sm"
                  disabled={markMastered.isPending || node?.status === 'mastered'}
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark Complete
                </button>
                <Link to={`/trees/${treeId}/quiz/${nodeId}`} className="btn-primary text-sm">
                  <Brain className="h-4 w-4" /> Take Quiz
                </Link>
              </div>
            </div>
          </div>

          {/* Lesson content */}
          <div className="card prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
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
                            fontSize: '0.875rem',
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
                        'bg-dark-primary px-1.5 py-0.5 rounded text-accent-cyan text-sm border border-dark-elevated',
                        className
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-cyan hover:underline"
                    >
                      {children}
                    </a>
                  );
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-4">
                      <table className="w-full text-left border-collapse border border-dark-elevated">
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

          {/* Worked Examples */}
          {content.examples.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Worked Examples</h3>
              <div className="space-y-3">
                {content.examples.map((example, i) => (
                  <div key={i} className="rounded-lg bg-dark-primary border border-dark-elevated p-4">
                    <button
                      onClick={() => {
                        const next = new Set(expandedExamples);
                        if (next.has(i)) {
                          next.delete(i);
                        } else {
                          next.add(i);
                        }
                        setExpandedExamples(next);
                      }}
                      className="flex items-center gap-2 w-full text-left font-medium text-text-primary"
                    >
                      {expandedExamples.has(i) ? (
                        <ChevronDown className="h-4 w-4 text-accent-purple" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-text-muted" />
                      )}
                      <span>Example {i + 1}</span>
                    </button>
                    {expandedExamples.has(i) && (
                      <div className="mt-3 text-sm text-text-secondary whitespace-pre-wrap pl-6 border-l border-accent-purple/30">
                        {example}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources & Citations */}
          {content.sources.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Grounding Sources & Citations</h3>
              <p className="text-xs text-text-muted mb-4">
                Materials retrieved via RAG and referenced during concept synthesis.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {content.sources.map((source, i) => (
                  <SourceCard key={i} source={source} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="card sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Concept Notes</h3>
              <Badge>{notes.length}</Badge>
            </div>
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-2.5 rounded bg-dark-primary border border-dark-elevated text-xs text-text-secondary"
                >
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-text-muted italic">No notes recorded for this concept.</p>
              )}
            </div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Record a personal thought or note..."
              className="input-field text-xs min-h-[70px] resize-y mb-2"
              rows={2}
            />
            <button
              onClick={handleAddNote}
              className="btn-secondary w-full text-xs"
              disabled={!newNote.trim()}
            >
              <Plus className="h-3 w-3" /> Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
