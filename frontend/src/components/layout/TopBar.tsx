import { useLocation } from 'react-router-dom';
import { Menu, Bell, User, Search } from 'lucide-react';
import { useAppStore, useSettingsStore } from '@/stores';
import { useState } from 'react';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/trees': 'My Skill Trees',
  '/explore': 'Explore',
  '/analytics': 'Analytics',
  '/achievements': 'Achievements',
  '/notes': 'My Notes',
  '/documents': 'Documents',
  '/reports': 'Reports',
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
  const [showSearch, setShowSearch] = useState(false);

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-dark-elevated bg-dark-primary/80 backdrop-blur-xl px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Page title */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-text-primary">{pageTitle}</h1>
      </div>

      {/* Global search toggle */}
      <button
        onClick={() => setShowSearch(!showSearch)}
        className="p-2 rounded-lg text-text-secondary hover:bg-dark-elevated hover:text-text-primary transition-colors"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Notifications placeholder */}
      <button
        className="p-2 rounded-lg text-text-secondary hover:bg-dark-elevated hover:text-text-primary transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </button>

      {/* User avatar */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-accent-purple/20 flex items-center justify-center">
          <User className="h-4 w-4 text-accent-purple" />
        </div>
        <span className="hidden sm:block text-sm font-medium text-text-primary">
          {displayName}
        </span>
      </div>
    </header>
  );
}
