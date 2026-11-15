import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Badge, ProgressBar, EmptyState, ErrorMessage } from '@/components/ui';
import { Sidebar } from '@/components/layout/Sidebar';
import { Sparkles, AlertTriangle } from 'lucide-react';

describe('UI Components', () => {
  describe('Badge', () => {
    it('renders text with correct variant styles', () => {
      render(<Badge variant="success">Mastered</Badge>);
      const badge = screen.getByText('Mastered');
      expect(badge).toBeTruthy();
      expect(badge.className).toContain('text-success');
    });

    it('renders danger variant', () => {
      render(<Badge variant="danger">Required</Badge>);
      const badge = screen.getByText('Required');
      expect(badge.className).toContain('text-danger');
    });
  });

  describe('ProgressBar', () => {
    it('renders progressbar with correct accessibility attributes', () => {
      render(<ProgressBar value={0.75} showLabel />);
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar.getAttribute('aria-valuenow')).toBe('75');
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100');
      expect(screen.getByText('75%')).toBeTruthy();
    });

    it('clamps values correctly between 0 and 100', () => {
      render(<ProgressBar value={1.5} showLabel />);
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar.getAttribute('aria-valuenow')).toBe('100');
    });
  });

  describe('EmptyState', () => {
    it('renders title, description and action', () => {
      render(
        <EmptyState
          icon={Sparkles}
          title="No Learning Pathways"
          description="Create your first skill tree to get started."
          action={<button>Create Pathway</button>}
        />
      );
      expect(screen.getByText('No Learning Pathways')).toBeTruthy();
      expect(screen.getByText('Create your first skill tree to get started.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Create Pathway' })).toBeTruthy();
    });
  });

  describe('ErrorMessage', () => {
    it('renders error title and message with retry button', () => {
      let retried = false;
      render(
        <ErrorMessage
          title="Connection Failure"
          message="Could not reach Ollama engine."
          onRetry={() => {
            retried = true;
          }}
        />
      );
      expect(screen.getByText('Connection Failure')).toBeTruthy();
      expect(screen.getByText('Could not reach Ollama engine.')).toBeTruthy();
      const retryBtn = screen.getByRole('button', { name: /try again/i });
      expect(retryBtn).toBeTruthy();
      retryBtn.click();
      expect(retried).toBe(true);
    });
  });

  describe('Sidebar Navigation', () => {
    it('renders exactly 9 navigation links and no redundant Learning Center or Quizzes', () => {
      render(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>
      );

      // Verify the 9 specific navigation items exist
      expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
      expect(screen.getAllByText('My Skill Trees').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Explore').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Achievements').length).toBeGreaterThan(0);
      expect(screen.getAllByText('My Notes').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Documents').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Reports').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);

      // Verify redundant items do NOT exist in the sidebar
      expect(screen.queryByText('Learning Center')).toBeNull();
      expect(screen.queryByText('Quizzes')).toBeNull();
    });
  });
});
