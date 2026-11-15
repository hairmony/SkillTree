import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ title = 'Something went wrong', message, onRetry, className }: ErrorMessageProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="h-14 w-14 rounded-2xl bg-danger/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-danger" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary max-w-md mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
