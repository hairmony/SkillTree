import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'cyan';
  className?: string;
}

const variants = {
  default: 'bg-dark-elevated text-text-secondary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  purple: 'bg-accent-purple/10 text-accent-purple',
  cyan: 'bg-accent-cyan/10 text-accent-cyan',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  );
}
