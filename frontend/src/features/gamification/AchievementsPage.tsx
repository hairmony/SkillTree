import {
  Trophy,
  Award,
  Sparkles,
  Flame,
  CheckCircle2,
  Lock,
  Star,
  Zap,
  BookOpen,
  Footprints,
  Compass,
  GraduationCap,
} from 'lucide-react';
import { useGamificationStore } from '@/stores';
import { ProgressBar, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Achievement } from '@/types';

const iconMap: Record<string, React.ElementType> = {
  footprints: Footprints,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  'check-circle': CheckCircle2,
  trophy: Trophy,
  star: Star,
  compass: Compass,
  award: Award,
  flame: Flame,
  zap: Zap,
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const isUnlocked = !!achievement.unlockedAt;
  const Icon = iconMap[achievement.icon] || Trophy;

  return (
    <div
      className={`card transition-all duration-200 ${
        isUnlocked
          ? 'border-accent-purple/40 bg-dark-card shadow-lg shadow-accent-purple/5'
          : 'opacity-60 bg-dark-secondary border-dark-elevated'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isUnlocked
              ? 'bg-gradient-to-br from-accent-purple to-accent-cyan text-white shadow-md'
              : 'bg-dark-elevated text-text-muted'
          }`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-text-primary truncate">{achievement.title}</h4>
            {isUnlocked ? (
              <Badge variant="success" className="text-[10px]">
                Unlocked
              </Badge>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
              </div>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-1">{achievement.description}</p>
          {isUnlocked && achievement.unlockedAt && (
            <p className="text-[11px] text-text-muted mt-2">
              Achieved on {formatDate(achievement.unlockedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { xp, level, achievements, streakDays, lessonsCompleted, quizzesPassed } =
    useGamificationStore();

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;
  const progressRatio = achievements.length > 0 ? unlockedCount / achievements.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Achievements & Milestones</h2>
        <p className="text-sm text-text-secondary mt-1">
          Gamified motivation designed to reinforce continuous deliberate practice
        </p>
      </div>

      {/* Hero Banner */}
      <div className="card bg-gradient-to-r from-accent-purple/20 via-dark-card to-accent-cyan/10 border-accent-purple/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-accent-purple flex items-center justify-center text-white shadow-xl shadow-accent-purple/20">
              <Trophy className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-text-primary">Level {level} Scholar</h3>
                <span className="badge bg-accent-purple/20 text-accent-purple font-semibold">
                  {xp} Total XP
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1">
                {unlockedCount} of {achievements.length} badges unlocked
              </p>
            </div>
          </div>
          <div className="w-full sm:w-64 space-y-2">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Next Level</span>
              <span>{xp % 100} / 100 XP</span>
            </div>
            <ProgressBar value={(xp % 100) / 100} size="md" color="purple" />
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center py-4">
          <Flame className="h-6 w-6 text-danger mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">{streakDays} Days</p>
          <p className="text-xs text-text-muted">Learning Streak</p>
        </div>
        <div className="card text-center py-4">
          <BookOpen className="h-6 w-6 text-accent-cyan mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">{lessonsCompleted}</p>
          <p className="text-xs text-text-muted">Lessons Completed</p>
        </div>
        <div className="card text-center py-4">
          <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">{quizzesPassed}</p>
          <p className="text-xs text-text-muted">Quizzes Passed</p>
        </div>
        <div className="card text-center py-4">
          <Sparkles className="h-6 w-6 text-accent-purple mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">{Math.round(progressRatio * 100)}%</p>
          <p className="text-xs text-text-muted">Badges Unlocked</p>
        </div>
      </div>

      {/* Achievements Grid */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4">All Badges</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-dark-secondary border border-dark-elevated text-xs text-text-muted">
        <p>
          <strong>Note on Data Persistence:</strong> Gamification achievements, experience points, and learning streaks are stored locally within your browser using versioned local storage.
        </p>
      </div>
    </div>
  );
}
