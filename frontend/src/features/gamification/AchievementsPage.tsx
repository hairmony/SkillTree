import { useMemo } from 'react';
import {
  Trophy,
  Flame,
  CheckCircle2,
  Lock,
  Star,
  BookOpen,
  Layers,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { useGamificationStore, checkAchievements } from '@/stores';
import { ProgressBar, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Achievement } from '@/types/app';

const iconMap: Record<string, React.ElementType> = {
  'book-open': BookOpen,
  layers: Layers,
  'shield-check': ShieldCheck,
  star: Star,
  flame: Flame,
  'graduation-cap': GraduationCap,
  award: GraduationCap,
};

function AchievementCard({
  achievement,
  currentValue,
}: {
  achievement: Achievement;
  currentValue: number;
}) {
  const isUnlocked = Boolean(achievement.unlockedAt);
  const Icon = iconMap[achievement.icon] || Trophy;
  const target = achievement.requirement.count;
  const progressRatio = Math.min(1, Math.max(0, currentValue / target));

  return (
    <div
      className={`card transition-all duration-200 ${
        isUnlocked
          ? 'border-accent-purple/40 bg-dark-card shadow-sm shadow-accent-purple/5'
          : 'opacity-80 bg-dark-secondary/60 border-dark-elevated hover:opacity-95'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
            isUnlocked
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
              : 'bg-dark-elevated text-text-muted border border-dark-elevated'
          }`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-text-primary text-base truncate">
              {achievement.title}
            </h4>
            {isUnlocked ? (
              <Badge variant="success" className="text-[10px] shrink-0">
                Unlocked
              </Badge>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-text-muted shrink-0">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
              </div>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-1">{achievement.description}</p>

          {/* Progress bar towards completion */}
          {!isUnlocked && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
                <span>Progress</span>
                <span className="font-medium text-text-secondary">
                  {currentValue} / {target}
                </span>
              </div>
              <ProgressBar value={progressRatio} size="sm" color="purple" />
            </div>
          )}

          {isUnlocked && achievement.unlockedAt && (
            <p className="text-[11px] text-text-muted mt-2.5">
              Achieved on {formatDate(achievement.unlockedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const store = useGamificationStore();
  const {
    xp,
    level,
    streakDays,
    lessonsCompleted,
    quizzesPassed,
    perfectQuizzes,
    treesCompleted,
  } = store;

  // Derive the 6 canonical achievements directly from store metrics and unlocked history
  const achievements: Achievement[] = useMemo(() => checkAchievements(store), [store]);

  const unlockedCount = achievements.filter((a) => Boolean(a.unlockedAt)).length;
  const progressRatio = achievements.length > 0 ? unlockedCount / achievements.length : 0;

  const getCurrentValueForType = (type: string): number => {
    switch (type) {
      case 'lessons_completed':
        return lessonsCompleted;
      case 'quizzes_passed':
        return quizzesPassed;
      case 'perfect_quiz':
        return perfectQuizzes;
      case 'streak_days':
        return streakDays;
      case 'trees_completed':
        return treesCompleted;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Achievements</h2>
        <p className="text-sm text-text-secondary mt-1">
          Milestones earned through active learning, concept mastery, and deliberate practice
        </p>
      </div>

      {/* Level & XP Overview Card */}
      <div className="card bg-gradient-to-r from-accent-purple/15 via-dark-card to-accent-cyan/10 border-accent-purple/25">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-accent-purple flex items-center justify-center text-white shadow-lg shadow-accent-purple/20 shrink-0">
              <Trophy className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-text-primary">Level {level}</h3>
                <span className="badge bg-accent-purple/20 text-accent-purple font-semibold text-xs">
                  {xp} XP
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {unlockedCount} of {achievements.length} achievements completed
              </p>
            </div>
          </div>
          <div className="w-full sm:w-60 space-y-1.5">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Next Level (Level {level + 1})</span>
              <span>{xp % 100} / 100 XP</span>
            </div>
            <ProgressBar value={(xp % 100) / 100} size="md" color="purple" />
          </div>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="card text-center py-3.5 px-2">
          <Flame className="h-5 w-5 text-danger mx-auto mb-1" />
          <p className="text-xl font-bold text-text-primary">{streakDays} Days</p>
          <p className="text-[11px] text-text-muted">Active Streak</p>
        </div>
        <div className="card text-center py-3.5 px-2">
          <BookOpen className="h-5 w-5 text-accent-cyan mx-auto mb-1" />
          <p className="text-xl font-bold text-text-primary">{lessonsCompleted}</p>
          <p className="text-[11px] text-text-muted">Concepts Completed</p>
        </div>
        <div className="card text-center py-3.5 px-2">
          <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-xl font-bold text-text-primary">{quizzesPassed}</p>
          <p className="text-[11px] text-text-muted">Quizzes Passed</p>
        </div>
        <div className="card text-center py-3.5 px-2">
          <Trophy className="h-5 w-5 text-accent-purple mx-auto mb-1" />
          <p className="text-xl font-bold text-text-primary">{Math.round(progressRatio * 100)}%</p>
          <p className="text-[11px] text-text-muted">Milestones Completed</p>
        </div>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-dark-elevated pb-2">
        <h3 className="text-sm font-semibold text-text-primary">
          Academic Milestones ({achievements.length})
        </h3>
        <span className="text-xs text-text-muted">
          {unlockedCount} of {achievements.length} Unlocked
        </span>
      </div>

      {/* Exactly Six Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            currentValue={getCurrentValueForType(achievement.requirement.type)}
          />
        ))}
      </div>
    </div>
  );
}
