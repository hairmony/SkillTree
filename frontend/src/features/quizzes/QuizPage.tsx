import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useCreateQuiz, useSubmitQuiz } from '@/hooks/useQuizQueries';
import { useTree } from '@/hooks/useTreeQueries';
import { useGamificationStore } from '@/stores';
import { Badge, ProgressBar } from '@/components/ui';
import { cn, formatPercent } from '@/lib/utils';
import { toast } from 'sonner';
import type { Quiz, QuizQuestion, QuizSubmitResponse } from '@/types';

function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  onSelect,
  showResult,
  result,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selectedAnswer: string | null;
  onSelect: (optionId: string) => void;
  showResult: boolean;
  result?: {
    correct: boolean;
    correct_option_id: string;
    explanation: string;
    concept: string;
  };
}) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              question.difficulty === 'easy'
                ? 'success'
                : question.difficulty === 'medium'
                ? 'warning'
                : 'danger'
            }
          >
            {question.difficulty}
          </Badge>
          <span className="text-xs text-text-muted">
            Question {index + 1} of {total}
          </span>
        </div>
      </div>
      <h3 className="text-base font-medium text-text-primary">{question.text}</h3>
      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedAnswer === option.id;
          const isCorrect = showResult && result?.correct_option_id === option.id;
          const isWrong = showResult && isSelected && !result?.correct;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !showResult && onSelect(option.id)}
              disabled={showResult}
              className={cn(
                'w-full text-left p-3.5 rounded-lg border-2 transition-all duration-200 flex items-start gap-3',
                showResult
                  ? isCorrect
                    ? 'border-success bg-success/10'
                    : isWrong
                    ? 'border-danger bg-danger/10'
                    : 'border-dark-elevated bg-dark-primary'
                  : isSelected
                  ? 'border-accent-purple bg-accent-purple/10'
                  : 'border-dark-elevated bg-dark-primary hover:border-accent-purple/30'
              )}
            >
              <div
                className={cn(
                  'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold',
                  showResult
                    ? isCorrect
                      ? 'border-success bg-success text-white'
                      : isWrong
                      ? 'border-danger bg-danger text-white'
                      : 'border-dark-elevated text-text-muted'
                    : isSelected
                    ? 'border-accent-purple bg-accent-purple text-white'
                    : 'border-dark-elevated text-text-muted'
                )}
              >
                {showResult ? (
                  isCorrect ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isWrong ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    option.id.toUpperCase()
                  )
                ) : isSelected ? (
                  '✓'
                ) : (
                  option.id.toUpperCase()
                )}
              </div>
              <span
                className={cn(
                  'text-sm',
                  showResult
                    ? isCorrect
                      ? 'text-success font-medium'
                      : isWrong
                      ? 'text-danger font-medium'
                      : 'text-text-secondary'
                    : 'text-text-primary'
                )}
              >
                {option.text}
              </span>
            </button>
          );
        })}
      </div>
      {showResult && result?.explanation && (
        <div
          className={cn(
            'p-3.5 rounded-lg text-sm border',
            result.correct
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-danger/10 border-danger/30 text-danger'
          )}
        >
          <p className="font-semibold mb-1">{result.correct ? '✓ Correct!' : '✗ Incorrect'}</p>
          <p className="text-text-secondary text-xs">{result.explanation}</p>
          {result.concept && (
            <p className="text-[11px] text-text-muted mt-2">Tested concept: {result.concept}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuizPage() {
  const { treeId, nodeId } = useParams<{ treeId: string; nodeId: string }>();
  const navigate = useNavigate();
  const { data: tree } = useTree(treeId);
  const createQuiz = useCreateQuiz();
  const submitQuiz = useSubmitQuiz();
  const recordQuizPassed = useGamificationStore((s) => s.recordQuizPassed);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const node = tree?.nodes.find((n) => n.id === nodeId);

  const handleStartQuiz = async () => {
    if (!treeId || !nodeId) return;
    setLoadError(null);
    try {
      const q = await createQuiz.mutateAsync({ treeId, nodeId });
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

  const allAnswered = quiz ? quiz.questions.every((q) => answers[q.id]) : false;

  const handleSubmit = async () => {
    if (!quiz || !allAnswered) return;
    try {
      const res = await submitQuiz.mutateAsync({ quizId: quiz.quiz_id, answers });
      setResult(res);
      if (res.passed) {
        recordQuizPassed(res.score, treeId, nodeId);
        toast.success(`Quiz passed with score: ${formatPercent(res.score)}!`);
      } else {
        toast.warning(
          `Scored ${formatPercent(res.score)} (< 75%). Review branch added to learning path.`
        );
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!quiz && !result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to Tree
        </button>
        <div className="card text-center py-12">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-accent-purple/10 flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-accent-purple" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">{node?.title || nodeId} Quiz</h2>
          <p className="text-text-secondary mt-2 mb-6">
            Assess mastery through Bayesian Knowledge Traced adaptive assessment
          </p>
          {loadError && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {loadError}
            </div>
          )}
          <button
            onClick={handleStartQuiz}
            className="btn-primary text-lg px-8 py-3"
            disabled={createQuiz.isPending}
          >
            {createQuiz.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Preparing Assessment...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5" /> Begin Quiz
              </>
            )}
          </button>
          <p className="text-xs text-text-muted mt-4">
            Multi-tier difficulty mix · Instant Bayesian grading · Dynamic DAG remediation
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    const correctCount = result.results.filter((r) => r.correct).length;
    const totalQ = result.results.length;

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to Tree
        </button>

        <div
          className={cn(
            'card text-center py-8',
            result.passed ? 'border-success/40' : 'border-warning/40'
          )}
        >
          <div
            className={cn(
              'h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-4',
              result.passed ? 'bg-success/10' : 'bg-warning/10'
            )}
          >
            {result.passed ? (
              <Trophy className="h-8 w-8 text-success" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-warning" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-text-primary">{formatPercent(result.score)}</h2>
          <p
            className={cn(
              'text-lg font-semibold mt-1',
              result.passed ? 'text-success' : 'text-warning'
            )}
          >
            {result.passed ? 'Mastery Demonstrated!' : 'Needs Conceptual Review'}
          </p>
          <p className="text-sm text-text-secondary mt-2">
            {correctCount} of {totalQ} correct · Passing threshold: {formatPercent(result.pass_score)}
          </p>
          <div className="mt-4 max-w-xs mx-auto">
            <ProgressBar
              value={result.mastery}
              showLabel
              color={result.mastery >= 0.75 ? 'green' : 'yellow'}
            />
            <p className="text-xs text-text-muted mt-1">Bayesian Knowledge Tracing (BKT) Posterior</p>
          </div>
        </div>

        {result.added.length > 0 && (
          <div className="card border-accent-purple/30">
            <div className="flex items-center gap-2 mb-3">
              <GitFork className="h-5 w-5 text-accent-purple" />
              <h3 className="font-semibold text-text-primary">Dynamic Pathways Synthesized</h3>
            </div>
            <p className="text-sm text-text-secondary mb-3">
              {result.passed
                ? 'Optional expansion nodes generated for missed knowledge components:'
                : 'Required review concept inserted before downstream nodes unlock:'}
            </p>
            <div className="space-y-2">
              {result.added.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-dark-primary border border-dark-elevated"
                >
                  <Badge variant={n.kind === 'required' ? 'danger' : 'warning'}>{n.kind}</Badge>
                  <span className="text-sm text-text-primary font-medium">{n.title}</span>
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

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Performance Breakdown</h3>
          {quiz &&
            quiz.questions.map((q, i) => {
              const r = result.results.find((res) => res.id === q.id);
              return (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  total={quiz.questions.length}
                  selectedAnswer={answers[q.id] || null}
                  onSelect={() => {}}
                  showResult={true}
                  result={
                    r
                      ? {
                          correct: r.correct,
                          correct_option_id: r.correct_option_id,
                          explanation: r.explanation,
                          concept: r.concept,
                        }
                      : undefined
                  }
                />
              );
            })}
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate(`/trees/${treeId}`)} className="btn-primary flex-1">
            <ArrowRight className="h-4 w-4" /> Return to Skill Tree
          </button>
          <button
            onClick={() => navigate(`/trees/${treeId}/learn/${nodeId}`)}
            className="btn-secondary"
          >
            <BookOpen className="h-4 w-4" /> Revisit Lesson
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{node?.title || nodeId} Quiz</h2>
            <p className="text-sm text-text-secondary">
              {Object.keys(answers).length} of {quiz?.questions.length || 0} answered
            </p>
          </div>
          <ProgressBar
            value={quiz ? Object.keys(answers).length / quiz.questions.length : 0}
            size="sm"
            className="w-32"
          />
        </div>
      </div>

      {quiz?.questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          index={i}
          total={quiz.questions.length}
          selectedAnswer={answers[q.id] || null}
          onSelect={(optionId) => handleSelectAnswer(q.id, optionId)}
          showResult={false}
        />
      ))}

      <div className="card">
        <button
          onClick={handleSubmit}
          className="btn-primary w-full py-3"
          disabled={!allAnswered || submitQuiz.isPending}
        >
          {submitQuiz.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Evaluating Responses...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" /> Submit Assessment (
              {Object.keys(answers).length}/{quiz?.questions.length || 0})
            </>
          )}
        </button>
        {!allAnswered && (
          <p className="text-xs text-text-muted text-center mt-2">
            Please answer all questions before submitting.
          </p>
        )}
      </div>
    </div>
  );
}
