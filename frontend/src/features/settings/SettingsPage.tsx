import { useState } from 'react';
import {
  Settings,
  User,
  Sliders,
  Trash2,
  Download,
  Upload,
  Info,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useSettingsStore, useGamificationStore, useNotesStore } from '@/stores';
import { ConfirmDialog } from '@/components/ui';
import { toast } from 'sonner';

export default function SettingsPage() {
  const {
    displayName,
    animationsEnabled,
    notificationsEnabled,
    reducedMotion,
    autoAdvance,
    quizQuestionCount,
    updateSettings,
    resetSettings,
  } = useSettingsStore();

  const { resetGamification } = useGamificationStore();
  const { notes } = useNotesStore();

  const [nameInput, setNameInput] = useState(displayName);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      updateSettings({ displayName: nameInput.trim() });
      toast.success('Display name updated');
    }
  };

  const handleExportAllState = () => {
    const data = {
      settings: useSettingsStore.getState(),
      gamification: useGamificationStore.getState(),
      notes: useNotesStore.getState().notes,
      exportedAt: new Date().toISOString(),
      version: 1,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skilltree-userdata-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Full frontend state exported');
  };

  const handleClearAllData = () => {
    resetSettings();
    resetGamification();
    localStorage.clear();
    setShowClearConfirm(false);
    toast.success('All local data cleared. Refreshing defaults.');
  };

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">System Settings & Preferences</h2>
        <p className="text-sm text-text-secondary mt-1">
          Customize your learning environment, accessibility, and local storage state
        </p>
      </div>

      {/* Profile Section */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-dark-elevated">
          <User className="h-5 w-5 text-accent-purple" />
          <h3 className="font-semibold text-text-primary">Learner Identity</h3>
        </div>
        <form onSubmit={handleSaveName} className="flex gap-3 items-end max-w-md">
          <div className="flex-1">
            <label htmlFor="learnerName" className="block text-xs font-medium text-text-secondary mb-1">
              Display Name
            </label>
            <input
              id="learnerName"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="input-field text-sm"
              placeholder="Your name"
            />
          </div>
          <button type="submit" className="btn-primary text-sm py-2">
            <Check className="h-4 w-4" /> Save
          </button>
        </form>
        <p className="text-xs text-text-muted">
          SkillTree operates in single-user local mode without server-side authentication.
        </p>
      </div>

      {/* Learning & Accessibility Preferences */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-dark-elevated">
          <Sliders className="h-5 w-5 text-accent-cyan" />
          <h3 className="font-semibold text-text-primary">Learning & Accessibility</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-dark-primary/40">
            <div>
              <p className="text-sm font-medium text-text-primary">UI Motion & Transitions</p>
              <p className="text-xs text-text-muted">Enable smooth animations across DAG and drawers</p>
            </div>
            <input
              type="checkbox"
              checked={animationsEnabled}
              onChange={(e) => updateSettings({ animationsEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-accent-purple"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-dark-primary/40">
            <div>
              <p className="text-sm font-medium text-text-primary">Reduced Motion Mode</p>
              <p className="text-xs text-text-muted">Disable decorative ambient transitions</p>
            </div>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
              className="h-4 w-4 rounded accent-accent-purple"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-dark-primary/40">
            <div>
              <p className="text-sm font-medium text-text-primary">Notification Toasts</p>
              <p className="text-xs text-text-muted">Show feedback messages on mastery milestones and actions</p>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-accent-purple"
            />
          </label>

          <div className="p-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Assessment Question Count</p>
              <p className="text-xs text-text-muted">Default number of questions requested for quizzes (3-6)</p>
            </div>
            <select
              value={quizQuestionCount}
              onChange={(e) => updateSettings({ quizQuestionCount: Number(e.target.value) })}
              className="input-field w-24 text-sm"
            >
              <option value={3}>3 questions</option>
              <option value={4}>4 questions</option>
              <option value={5}>5 questions</option>
              <option value={6}>6 questions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Local Storage Data Management */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-dark-elevated">
          <Trash2 className="h-5 w-5 text-danger" />
          <h3 className="font-semibold text-text-primary">Data Management & Persistence</h3>
        </div>

        <p className="text-xs text-text-secondary">
          Export your notes, gamification level, and settings to a JSON backup, or reset browser storage.
        </p>

        <div className="flex flex-wrap gap-3">
          <button onClick={handleExportAllState} className="btn-secondary text-xs">
            <Download className="h-3.5 w-3.5" /> Backup User Data (JSON)
          </button>
          <button onClick={() => setShowClearConfirm(true)} className="btn-danger text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Clear Browser Storage
          </button>
        </div>
      </div>

      {/* Platform & Research Metadata */}
      <div className="card bg-dark-secondary/60 border-dark-elevated">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-accent-purple shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary space-y-1">
            <p className="font-semibold text-text-primary">SkillTree Research Platform</p>
            <p>Master's Research Project: Adaptive Learning Platform for Skill-Building</p>
            <p>
              Backend API Target:{' '}
              <code className="text-accent-cyan">
                {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000 (proxied via /api)'}
              </code>
            </p>
            <p>Embedding: mxbai-embed-large | Chat / DAG: qwen3.5:4b | Knowledge Tracing: Bayesian Knowledge Tracing (BKT)</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllData}
        title="Clear All Local Browser Data?"
        message="This will reset your local XP, levels, streaks, notes, and preferences. Backend SQLite skill trees and quiz databases will remain intact."
        confirmLabel="Clear Data"
        variant="danger"
      />
    </div>
  );
}
