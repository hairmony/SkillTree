import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-1
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'purple' | 'cyan' | 'green' | 'yellow';
}

const colorClasses = {
  purple: 'bg-accent-purple',
  cyan: 'bg-accent-cyan',
  green: 'bg-success',
  yellow: 'bg-warning',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({ value, className, showLabel, size = 'md', color = 'purple' }: ProgressBarProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full rounded-full bg-dark-elevated overflow-hidden', sizeClasses[size])}>
        <div
          className={cn('rounded-full transition-all duration-500 ease-out', sizeClasses[size], colorClasses[color])}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-text-secondary mt-1 block text-right">{percent}%</span>
      )}
    </div>
  );
}
