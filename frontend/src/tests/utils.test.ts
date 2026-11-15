import { describe, it, expect } from 'vitest';
import {
  formatPercent,
  formatDate,
  formatRelativeTime,
  clamp,
  levelFromXP,
  xpForLevel,
  truncate,
  safeJsonParse,
} from '@/lib/utils';

describe('Utility Functions', () => {
  describe('formatPercent', () => {
    it('formats 0.5 as 50%', () => {
      expect(formatPercent(0.5)).toBe('50%');
    });

    it('formats 0.756 as 76%', () => {
      expect(formatPercent(0.756)).toBe('76%');
    });

    it('formats 1 as 100%', () => {
      expect(formatPercent(1)).toBe('100%');
    });

    it('formats 0 as 0%', () => {
      expect(formatPercent(0)).toBe('0%');
    });
  });

  describe('clamp', () => {
    it('clamps below minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps above maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('retains value within bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
  });

  describe('levelFromXP and xpForLevel', () => {
    it('calculates level 1 for 0 XP', () => {
      expect(levelFromXP(0)).toBe(1);
    });

    it('calculates level 1 for 99 XP', () => {
      expect(levelFromXP(99)).toBe(1);
    });

    it('calculates level 2 for 100 XP', () => {
      expect(levelFromXP(100)).toBe(2);
    });

    it('calculates level 5 for 450 XP', () => {
      expect(levelFromXP(450)).toBe(5);
    });

    it('computes correct threshold XP', () => {
      expect(xpForLevel(1)).toBe(100);
      expect(xpForLevel(5)).toBe(500);
    });
  });

  describe('truncate', () => {
    it('does not truncate short text', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('truncates long text with ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid json', () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it('returns fallback on invalid json', () => {
      expect(safeJsonParse('{invalid}', { fallback: true })).toEqual({ fallback: true });
    });
  });

  describe('formatDate', () => {
    it('formats valid date string', () => {
      const res = formatDate('2026-11-15T06:00:00Z');
      expect(res).toBeTruthy();
    });
  });
});
