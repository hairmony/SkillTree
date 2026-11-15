import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn('card animate-pulse', className)}>
      <div className="h-5 w-2/3 skeleton mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={cn('skeleton mb-2', i === lines - 1 ? 'h-3 w-1/2' : 'h-3 w-full')} />
      ))}
    </div>
  );
}
