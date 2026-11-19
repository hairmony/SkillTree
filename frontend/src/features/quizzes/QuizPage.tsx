import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trophy,
  BookOpen,
  Loader2,
  ArrowRight,
  GitFork,
  Sparkles,
  RotateCcw,
  History,
  Check,
} from 'lucide-react';
import { useCreateQuiz, useSubmitQuiz } from '@/hooks/useQuizQueries';
import { useTree } from '@/hooks/useTreeQueries';
import { useGamificationStore, useSettingsStore } from '@/stores';
import { Badge, ProgressBar } from '@/components/ui';
import { cn, formatPercent } from '@/lib/utils';
import { toast } from 'sonner';
import type { Quiz, QuizQuestion, QuizSubmitResponse } from '@/types';

export default function QuizPage() {
  const { treeId, nodeId } = useParams<{ treeId: string; nodeId: string }>();
  const navigate = useNavigate();
  const { data: tree } = useTree(treeId);
  const createQuiz = useCreateQuiz();
  const submitQuiz = useSubmitQuiz();
  const recordQuizPassed = useGamificationStore((s) => s.recordQuizPassed);
  const defaultQuestionCount = useSettingsStore((s) => s.quizQuestionCount);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(defaultQuestionCount || 5);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const node = tree?.nodes.find((n) => n.id === nodeId);

  // Live timer while quiz generation is in progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (createQuiz.isPending) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [createQuiz.isPending]);

  const handleStartQuiz = async () => {
    if (!treeId || !nodeId || createQuiz.isPending) return;
    setLoadError(null);
    setCurrentIndex(0);
    try {
      const q = await createQuiz.mutateAsync({ treeId, nodeId, numQuestions });
      setQuiz(q);
      setAnswers({});
      setResult(null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  };

  const handleSelectAnswer = (questionId: number, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const currentQuestion: QuizQuestion | undefined = quiz?.questions[currentIndex];
  const totalQuestions = quiz?.questions.length || 0;
  const answeredCount = quiz ? quiz.questions.filter((q) => Boolean(answers[q.id])).length : 0;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const handleSubmit = async () => {
    if (!quiz || !allAnswered) return;
    try {
      const res = await submitQuiz.mutateAsync({
        quizId: quiz.quiz_id,
        answers,
        treeId,
      });
      setResult(res);
      if (res.passed) {
        recordQuizPassed(res.score, treeId, nodeId);
        toast.success(`Assessment passed with ${formatPercent(res.score)}!`);
      } else {
        toast.warning(
          `Scored ${formatPercent(res.score)} (< 75%). Review branch added to learning path.`
        );
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // 1. Initial State: Start / Generate Quiz Card
  if (!quiz && !result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to Tree
        </button>

        <div className="card text-center py-10 px-6 sm:px-10">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-accent-purple/10 flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-accent-purple" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge variant="purple">Adaptive Assessment</Badge>
            {node?.kind && node.kind !== 'core' && (
              <Badge variant={node.kind === 'required' ? 'danger' : 'warning'}>
                {node.kind}
              </Badge>
            )}
          </div>

          <h2 className="text-2xl font-bold text-text-primary">
            {node?.title || nodeId} Quiz
          </h2>

          <p className="text-text-secondary mt-2 max-w-lg mx-auto text-sm leading-relaxed">
            {node?.description ||
              'Test your conceptual understanding and apply what you learned in this topic.'}
          </p>

          {/* Question Count Selector */}
          <div className="my-6 p-4 rounded-xl bg-dark-primary border border-dark-elevated text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                Select Assessment Length
              </span>
              <span className="text-xs text-text-muted">
                {numQuestions === 3 ? 'Fast (~45-75s)' : numQuestions === 5 ? 'Standard (~90-120s)' : 'Comprehensive (~120-180s)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  disabled={createQuiz.isPending}
                  onClick={() => setNumQuestions(count)}
                  className={cn(
                    'py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-0.5 border transition-all',
                    numQuestions === count
                      ? 'border-accent-purple bg-accent-purple/20 text-text-primary ring-1 ring-accent-purple'
                      : 'border-dark-elevated bg-dark-card text-text-secondary hover:text-text-primary hover:border-dark-elevated/80'
                  )}
                >
                  <span className="font-bold text-sm">{count} Questions</span>
                  <span className="text-[10px] text-text-muted">
                    {count === 3 ? 'Quick Check' : count === 5 ? 'Balanced Mix' : 'Deep Mastery'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-left">
            <div className="p-3.5 rounded-xl bg-dark-primary border border-dark-elevated">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">
                Format
              </span>
              <span className="text-sm font-semibold text-text-primary mt-1 block">
                {numQuestions} Questions
              </span>
              <span className="text-xs text-text-secondary">Easy · Medium · Hard Mix</span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-primary border border-dark-elevated">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">
                Passing Goal
              </span>
              <span className="text-sm font-semibold text-success mt-1 block">
                ≥ 75% Mastery
              </span>
              <span className="text-xs text-text-secondary">Bayesian Knowledge Tracing</span>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-primary border border-dark-elevated">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">
                Adaptive DAG
              </span>
              <span className="text-sm font-semibold text-accent-cyan mt-1 block">
                Dynamic Remediation
              </span>
              <span className="text-xs text-text-secondary">Auto-inserts review if needed</span>
            </div>
          </div>

          {loadError && (
            <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/30 text-left space-y-3">
              <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Quiz Generation Failed</span>
              </div>
              <p className="text-xs text-text-secondary">{loadError}</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleStartQuiz}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry Assessment Generation
                </button>
              </div>
            </div>
          )}

          {createQuiz.isPending ? (
            <div className="py-6 px-4 rounded-xl bg-dark-primary border border-accent-purple/30 space-y-3">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 text-accent-purple animate-spin" />
                <span className="text-sm font-semibold text-text-primary">
                  {elapsedSeconds < 15
                    ? 'Retrieving knowledge chunks & preparing prompt...'
                    : elapsedSeconds < 55
                    ? `Generating ${numQuestions} adaptive questions with Ollama AI (qwen3.5:4b)...`
                    : 'Finalizing distractors, answer keys & pedagogical explanations...'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent-cyan">
                <span>Elapsed: {elapsedSeconds}s</span>
              </div>

              <p className="text-[11px] text-text-muted max-w-md mx-auto">
                Local GPU inference is processing. Please remain on this page while questions are formulated.
              </p>
            </div>
          ) : (
            <button
              onClick={handleStartQuiz}
              disabled={createQuiz.isPending}
              className="btn-primary text-base px-8 py-3 shadow-lg shadow-accent-purple/20 disabled:opacity-50"
            >
              <Sparkles className="h-5 w-5" /> Start Assessment ({numQuestions} Questions)
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Quiz Results Screen
  if (result) {
    const correctCount = result.results.filter((r) => r.correct).length;
    const totalQ = result.results.length;
    const requiredNode = result.added.find((n) => n.kind === 'required');
    const optionalNodes = result.added.filter((n) => n.kind === 'optional');

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
        <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to Tree
        </button>

        {/* Score Card */}
        <div
          className={cn(
            'card text-center py-8 px-6 border-2',
            result.passed ? 'border-success/50 bg-success/5' : 'border-warning/50 bg-warning/5'
          )}
        >
          <div
            className={cn(
              'h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-4',
              result.passed ? 'bg-success/15' : 'bg-warning/15'
            )}
          >
            {result.passed ? (
              <Trophy className="h-8 w-8 text-success" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-warning" />
            )}
          </div>

          <h2 className="text-3xl font-extrabold text-text-primary">
            {formatPercent(result.score)}
          </h2>

          <p
            className={cn(
              'text-lg font-semibold mt-1',
              result.passed ? 'text-success' : 'text-warning'
            )}
          >
            {result.passed ? 'Concept Mastery Achieved!' : 'Needs Conceptual Review'}
          </p>

          <p className="text-sm text-text-secondary mt-1">
            {correctCount} of {totalQ} questions answered correctly · Passing threshold:{' '}
            {formatPercent(result.pass_score)}
          </p>

          {/* BKT Posterior Bar */}
          <div className="mt-5 max-w-sm mx-auto p-3.5 rounded-xl bg-dark-primary border border-dark-elevated text-left">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-text-secondary">
                Bayesian Knowledge Tracing (BKT) Posterior
              </span>
              <span className="font-bold text-text-primary">
                {Math.round(result.mastery * 100)}%
              </span>
            </div>
            <ProgressBar
              value={result.mastery}
              size="sm"
              color={result.mastery >= 0.75 ? 'green' : 'yellow'}
            />
            <p className="text-[11px] text-text-muted mt-2">
              {result.passed
                ? 'Your posterior probability exceeds 0.75, unlocking subsequent dependent concepts.'
                : 'Posterior mastery is below threshold. A targeted review topic has been generated.'}
            </p>
          </div>
        </div>

        {/* Adaptive Nodes Notice */}
        {result.added.length > 0 && (
          <div className="card border-accent-purple/40 space-y-3 bg-dark-secondary">
            <div className="flex items-center gap-2">
              <GitFork className="h-5 w-5 text-accent-purple" />
              <h3 className="font-semibold text-text-primary">
                {result.passed
                  ? 'Adaptive Enrichment Branches Added'
                  : 'Remediation Review Concept Spliced into DAG'}
              </h3>
            </div>

            <p className="text-sm text-text-secondary">
              {result.passed
                ? 'Based on missed questions, optional enrichment branches have been attached to your skill tree for deeper study:'
                : 'Because your score was under 75%, an AI-generated remediation node was spliced directly into your DAG before downstream concepts can unlock:'}
            </p>

            <div className="space-y-2 mt-2">
              {result.added.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-primary border border-dark-elevated"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={n.kind === 'required' ? 'danger' : 'warning'}>
                      {n.kind}
                    </Badge>
                    <span className="text-sm text-text-primary font-medium truncate">
                      {n.title}
                    </span>
                  </div>
                  <Link
                    to={`/trees/${treeId}/learn/${n.id}`}
                    className="btn-secondary text-xs py-1 px-3 shrink-0 ml-2"
                  >
                    Study Concept →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.added_error && (
          <div className="card bg-warning/5 border-warning/20">
            <p className="text-sm text-warning">{result.added_error}</p>
          </div>
        )}

        {/* Full Question Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Performance Breakdown</h3>
            <span className="text-xs text-text-muted">
              {correctCount}/{totalQ} correct
            </span>
          </div>

          {result.results.map((r, i) => {
            const originalQ = quiz?.questions.find((q) => q.id === r.id);
            const options = r.options || originalQ?.options || [];

            return (
              <div
                key={r.id}
                className={cn(
                  'card space-y-3 border',
                  r.correct ? 'border-success/30' : 'border-danger/30'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.correct ? 'success' : 'danger'}>
                      {r.correct ? 'Correct' : 'Missed'}
                    </Badge>
                    <span className="text-xs text-text-muted">Question {i + 1} of {totalQ}</span>
                  </div>
                  {r.concept && (
                    <span className="text-xs text-text-muted">Concept: {r.concept}</span>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-text-primary">{r.text}</h4>

                <div className="space-y-2">
                  {options.map((opt) => {
                    const isChosen = r.chosen === opt.id;
                    const isCorrect = r.correct_option_id === opt.id;

                    return (
                      <div
                        key={opt.id}
                        className={cn(
                          'p-3 rounded-lg border text-sm flex items-start gap-3 transition-colors',
                          isCorrect
                            ? 'border-success bg-success/10 text-success'
                            : isChosen && !isCorrect
                            ? 'border-danger bg-danger/10 text-danger'
                            : 'border-dark-elevated bg-dark-primary text-text-secondary opacity-75'
                        )}
                      >
                        <div
                          className={cn(
                            'h-6 w-6 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold',
                            isCorrect
                              ? 'border-success bg-success text-white'
                              : isChosen && !isCorrect
                              ? 'border-danger bg-danger text-white'
                              : 'border-dark-elevated text-text-muted'
                          )}
                        >
                          {isCorrect ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : isChosen && !isCorrect ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            opt.id.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1">
                          <span>{opt.text}</span>
                          {isChosen && !isCorrect && (
                            <span className="block text-[11px] font-medium text-danger mt-0.5">
                              (Your answer)
                            </span>
                          )}
                          {isCorrect && (
                            <span className="block text-[11px] font-medium text-success mt-0.5">
                              (Correct answer)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {r.explanation && (
                  <div
                    className={cn(
                      'p-3 rounded-lg text-xs leading-relaxed border',
                      r.correct
                        ? 'bg-success/5 border-success/20 text-text-secondary'
                        : 'bg-danger/5 border-danger/20 text-text-secondary'
                    )}
                  >
                    <p className="font-semibold text-text-primary mb-1">Pedagogical Explanation:</p>
                    <p>{r.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          {requiredNode ? (
            <Link
              to={`/trees/${treeId}/learn/${requiredNode.id}`}
              className="btn-danger flex-1 py-3 justify-center flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" /> Begin Review: {requiredNode.title}
            </Link>
          ) : (
            <button
              onClick={() => navigate(`/trees/${treeId}`)}
              className="btn-primary flex-1 py-3 justify-center flex items-center gap-2"
            >
              <ArrowRight className="h-4 w-4" /> Return to Skill Tree
            </button>
          )}

          <button
            onClick={() => {
              setResult(null);
              handleStartQuiz();
            }}
            className="btn-secondary py-3 px-5 justify-center flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Retake Quiz
          </button>

          <Link
            to={`/trees/${treeId}/learn/${nodeId}`}
            className="btn-ghost py-3 px-4 justify-center flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" /> Revisit Lesson
          </Link>
        </div>
      </div>
    );
  }

  // 3. Step-by-Step Question Interface
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="card">
        <div className="flex items-center justify-between pb-3 border-b border-dark-elevated">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/trees/${treeId}`)}
              className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-elevated transition-colors"
              title="Exit Quiz"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-base font-bold text-text-primary truncate">
                {node?.title || nodeId} Quiz
              </h2>
              <p className="text-xs text-text-secondary">
                {answeredCount} of {totalQuestions} answered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-secondary">
              Question {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
        </div>

        {/* Question Pagination Pills */}
        <div className="flex items-center justify-between gap-1.5 pt-3 overflow-x-auto">
          {quiz?.questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  'flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                  isCurrent
                    ? 'bg-accent-purple text-white shadow-md shadow-accent-purple/30 ring-2 ring-accent-cyan'
                    : isAnswered
                    ? 'bg-accent-purple/20 text-accent-cyan border border-accent-purple/30 hover:bg-accent-purple/30'
                    : 'bg-dark-primary text-text-muted border border-dark-elevated hover:text-text-primary hover:bg-dark-elevated'
                )}
              >
                <span>{idx + 1}</span>
                {isAnswered && <Check className="h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Card */}
      {currentQuestion && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  currentQuestion.difficulty === 'easy'
                    ? 'success'
                    : currentQuestion.difficulty === 'medium'
                    ? 'warning'
                    : 'danger'
                }
              >
                {currentQuestion.difficulty}
              </Badge>
              <span className="text-xs text-text-muted">
                Question {currentIndex + 1} of {totalQuestions}
              </span>
            </div>

            {answers[currentQuestion.id] && (
              <span className="text-xs text-success flex items-center gap-1 font-medium">
                <Check className="h-3.5 w-3.5" /> Answer saved
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-medium text-text-primary leading-snug">
            {currentQuestion.text}
          </h3>

          {/* Multiple-Choice Options */}
          <div className="space-y-2.5">
            {currentQuestion.options.map((option) => {
              const isSelected = answers[currentQuestion.id] === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectAnswer(currentQuestion.id, option.id)}
                  className={cn(
                    'w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200 flex items-start gap-3',
                    isSelected
                      ? 'border-accent-purple bg-accent-purple/15 text-text-primary ring-1 ring-accent-purple shadow-md shadow-accent-purple/10'
                      : 'border-dark-elevated bg-dark-primary hover:border-accent-purple/40 text-text-secondary hover:text-text-primary'
                  )}
                >
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-colors',
                      isSelected
                        ? 'border-accent-purple bg-accent-purple text-white'
                        : 'border-dark-elevated text-text-muted'
                    )}
                  >
                    {isSelected ? '✓' : option.id.toUpperCase()}
                  </div>
                  <span className="text-sm font-normal leading-relaxed pt-0.5">
                    {option.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Question Footer Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-dark-elevated">
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>

            <span className="text-xs text-text-muted hidden sm:inline">
              {answers[currentQuestion.id] ? (
                <span className="text-success font-medium">Answered</span>
              ) : (
                <span className="text-warning">Select an option</span>
              )}
            </span>

            {isLastQuestion ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered || submitQuiz.isPending}
                className="btn-primary text-sm shadow-md shadow-accent-purple/20"
              >
                {submitQuiz.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Evaluating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Submit Quiz ({answeredCount}/{totalQuestions})
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                className="btn-primary text-sm"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Submission Overlay when in progress */}
      {submitQuiz.isPending && (
        <div className="card text-center py-6 border-accent-purple/30 bg-accent-purple/5 space-y-2">
          <div className="flex items-center justify-center gap-2 text-accent-purple font-semibold">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Evaluating Responses with Bayesian Knowledge Tracing...</span>
          </div>
          <p className="text-xs text-text-secondary">
            Updating concept posterior mastery and determining prerequisite unlocks.
          </p>
        </div>
      )}

      {/* Global Submit Banner when all answered but not on last question */}
      {!isLastQuestion && allAnswered && (
        <div className="card bg-success/10 border-success/30 flex items-center justify-between p-3.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span className="text-xs text-text-primary font-medium">
              All 5 questions answered! Ready to evaluate.
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitQuiz.isPending}
            className="btn-primary text-xs py-1.5 px-3"
          >
            Submit Now
          </button>
        </div>
      )}
    </div>
  );
}
