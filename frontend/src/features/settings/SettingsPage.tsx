import { useState } from 'react';
import {
  User,
  Sliders,
  Check,
  Sparkles,
  Bell,
  HelpCircle,
} from 'lucide-react';
import { useSettingsStore } from '@/stores';
import { toast } from 'sonner';

export default function SettingsPage() {
  const {
    displayName,
    animationsEnabled,
    notificationsEnabled,
    reducedMotion,
    quizQuestionCount,
    updateSettings,
  } = useSettingsStore();

  const [nameInput, setNameInput] = useState(displayName);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      updateSettings({ displayName: nameInput.trim() });
      toast.success('Display name saved');
    }
  };

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Settings</h2>
        <p className="text-sm text-text-secondary mt-1">
          Manage your profile and learning preferences.
        </p>
      </div>

      {/* Profile Section */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-dark-elevated">
          <User className="h-5 w-5 text-accent-purple" />
          <h3 className="font-semibold text-text-primary">Profile</h3>
        </div>

        <form onSubmit={handleSaveName} className="space-y-3">
          <div className="max-w-md">
            <label
              htmlFor="learnerName"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Display Name
            </label>
            <div className="flex gap-2.5">
              <input
                id="learnerName"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="input-field text-sm flex-1"
                placeholder="Enter your name"
                maxLength={40}
              />
              <button
                type="submit"
                className="btn-primary text-sm py-2 px-4 shrink-0 flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" /> Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Learning Preferences */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-dark-elevated">
          <Sliders className="h-5 w-5 text-accent-cyan" />
          <h3 className="font-semibold text-text-primary">Learning Preferences</h3>
        </div>

        <div className="space-y-3 divide-y divide-dark-elevated/40">
          {/* UI Animations */}
          <label className="flex items-center justify-between cursor-pointer pt-2 pb-1 hover:bg-dark-secondary/30 rounded-lg p-2 transition-colors">
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-accent-purple mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-text-primary">Interface Animations</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Enable smooth visual transitions across trees, nodes, and quiz panels
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={animationsEnabled}
              onChange={(e) => updateSettings({ animationsEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-accent-purple shrink-0 ml-4 cursor-pointer"
            />
          </label>

          {/* Reduced Motion Accessibility */}
          <label className="flex items-center justify-between cursor-pointer pt-3 pb-1 hover:bg-dark-secondary/30 rounded-lg p-2 transition-colors">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-4 w-4 text-accent-cyan mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-text-primary">Reduced Motion (Accessibility)</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Minimize motion effects for users with vestibular or motion sensitivities
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
              className="h-4 w-4 rounded accent-accent-purple shrink-0 ml-4 cursor-pointer"
            />
          </label>

          {/* Notification Toasts */}
          <label className="flex items-center justify-between cursor-pointer pt-3 pb-1 hover:bg-dark-secondary/30 rounded-lg p-2 transition-colors">
            <div className="flex items-start gap-3">
              <Bell className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-text-primary">Notifications</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Display toast alerts for completed concepts, quiz scores, and achievements
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-accent-purple shrink-0 ml-4 cursor-pointer"
            />
          </label>

          {/* Default Quiz Question Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 p-2">
            <div>
              <p className="text-sm font-medium text-text-primary">Default Quiz Question Count</p>
              <p className="text-xs text-text-muted mt-0.5">
                Default number of questions requested for knowledge checks (3–6)
              </p>
            </div>
            <select
              value={quizQuestionCount}
              onChange={(e) => updateSettings({ quizQuestionCount: Number(e.target.value) })}
              className="input-field w-36 text-sm shrink-0"
            >
              <option value={3}>3 Questions</option>
              <option value={4}>4 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={6}>6 Questions</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
