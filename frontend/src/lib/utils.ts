import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a number as a percentage string */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Format a date string for display */
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Format relative time (e.g., "2 hours ago") */
export function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

/** Generate a unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Clamp a number to a range */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Calculate XP for a level */
export function xpForLevel(level: number): number {
  return level * 100;
}

/** Calculate level from XP */
export function levelFromXP(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

/** Debounce a function */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number
): (...args: A) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/** Safe JSON parse */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** Get today's date as YYYY-MM-DD */
export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}
