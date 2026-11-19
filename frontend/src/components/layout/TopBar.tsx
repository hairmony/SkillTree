import { useLocation, Link } from 'react-router-dom';
import { Menu, User } from 'lucide-react';
import { useAppStore, useSettingsStore } from '@/stores';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/trees': 'My Skill Trees',
  '/explore': 'Explore Pathways',
  '/analytics': 'Analytics',
  '/achievements': 'Achievements & XP',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path) && path !== '/') return title;
  }
  return 'SkillTree';
}

export function TopBar() {
  const location = useLocation();
  const setMobileOpen = useAppStore((s) => s.setMobileOpen);
  const displayName = useSettingsStore((s) => s.displayName);

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-dark-elevated bg-dark-primary/80 backdrop-blur-xl px-4 lg:px-6">
      {/* Mobile menu button & page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="lg:hidden text-text-secondary hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-dark-elevated"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-text-primary truncate">{pageTitle}</h1>
      </div>

      {/* User profile */}
      <div className="flex items-center">
        <Link
          to="/settings"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-dark-elevated transition-colors group"
          title="Profile & Settings"
        >
          <div className="h-8 w-8 rounded-full bg-accent-purple/20 flex items-center justify-center group-hover:bg-accent-purple/30 transition-colors">
            <User className="h-4 w-4 text-accent-purple" />
          </div>
          <span className="hidden sm:block text-sm font-medium text-text-primary group-hover:text-accent-purple transition-colors">
            {displayName}
          </span>
        </Link>
      </div>
    </header>
  );
}

