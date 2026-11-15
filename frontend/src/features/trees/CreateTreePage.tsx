import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useCreateTree, useTreeStatus } from '@/hooks/useTreeQueries';
import { useGamificationStore } from '@/stores';
import { toast } from 'sonner';

export default function CreateTreePage() {
  const navigate = useNavigate();
  const createTree = useCreateTree();
  const recordTreeStarted = useGamificationStore((s) => s.recordTreeStarted);

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [userText, setUserText] = useState('');
  const [createdTreeId, setCreatedTreeId] = useState<string | null>(null);

  const { data: status } = useTreeStatus(createdTreeId ?? undefined, !!createdTreeId);

  useEffect(() => {
    if (status?.state === 'done' && createdTreeId) {
      toast.success('Skill tree created successfully!');
      recordTreeStarted();
      const timer = setTimeout(() => navigate(`/trees/${createdTreeId}`), 1000);
      return () => clearTimeout(timer);
    }
  }, [status?.state, createdTreeId, navigate, recordTreeStarted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    try {
      const result = await createTree.mutateAsync({
        topic: topic.trim(),
        description: description.trim() || undefined,
        text: userText.trim() || undefined,
      });
      setCreatedTreeId(result.tree_id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const isGenerating = !!createdTreeId && status?.state === 'running';
  const hasFailed = status?.state === 'failed';
  const isDone = status?.state === 'done';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="text-center mb-8">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-accent-purple/10 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-accent-purple" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary">Create New Skill Tree</h2>
        <p className="text-text-secondary mt-2">
          Enter a topic and SkillTree will retrieve multimodal educational resources and synthesize an interactive DAG
        </p>
      </div>

      {createdTreeId && (
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            {isGenerating && <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />}
            {isDone && <CheckCircle2 className="h-5 w-5 text-success" />}
            {hasFailed && <XCircle className="h-5 w-5 text-danger" />}
            <h3 className="font-semibold text-text-primary">
              {isGenerating
                ? 'Building Your Skill Tree...'
                : isDone
                ? 'Skill Tree Ready!'
                : 'Generation Failed'}
            </h3>
          </div>
          <p className="text-sm text-text-secondary">{status?.message || 'Planting skill tree...'}</p>
          {isGenerating && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-dark-elevated overflow-hidden">
              <div
                className="h-full bg-accent-purple rounded-full animate-pulse"
                style={{ width: '70%' }}
              />
            </div>
          )}
          {hasFailed && (
            <button
              onClick={() => {
                setCreatedTreeId(null);
              }}
              className="btn-secondary mt-4"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {!createdTreeId && (
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-text-primary mb-2">
              What do you want to learn? *
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Quantum Computing, Reinforcement Learning, Linear Algebra"
              className="input-field text-lg"
              required
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Learning Goals <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what specific subtopics or depth you would like to target..."
              className="input-field min-h-[80px] resize-y"
              rows={3}
            />
          </div>

          <div>
            <label
              htmlFor="userText"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Your Study Notes <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              id="userText"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Paste any syllabus, textbook excerpts, or custom notes you'd like to index..."
              className="input-field min-h-[100px] resize-y font-mono text-sm"
              rows={4}
            />
            <p className="text-xs text-text-muted mt-1">
              SkillTree will automatically search YouTube, academic papers, Wikipedia, and the web.
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3 text-base"
            disabled={!topic.trim() || createTree.isPending}
          >
            {createTree.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Initializing Pipeline...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" /> Generate Skill Tree
              </>
            )}
          </button>
        </form>
      )}

      {!createdTreeId && (
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Suggested Topics</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'Machine Learning',
              'Quantum Computing',
              'Linear Algebra',
              'Distributed Systems',
              'Computer Vision',
              'Data Structures & Algorithms',
              'Deep Learning',
              'Cybersecurity',
            ].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className="badge bg-dark-elevated text-text-secondary hover:bg-accent-purple/10 hover:text-accent-purple transition-colors cursor-pointer px-3 py-1.5"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
