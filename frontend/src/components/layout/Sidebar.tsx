import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  GitFork,
  Search,
  BarChart3,
  Trophy,
  StickyNote,
  FileText,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'trees', label: 'My Skill Trees', path: '/trees', icon: GitFork },
  { id: 'explore', label: 'Explore', path: '/explore', icon: Search },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { id: 'achievements', label: 'Achievements', path: '/achievements', icon: Trophy },
  { id: 'notes', label: 'My Notes', path: '/notes', icon: StickyNote },
  { id: 'documents', label: 'Documents', path: '/documents', icon: FileText },
  { id: 'reports', label: 'Reports', path: '/reports', icon: FileBarChart },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
] as const;

export function Sidebar() {
  const location = useLocation();
  const { sidebar, toggleSidebar, setMobileOpen } = useAppStore();
  const { isCollapsed, isMobileOpen } = sidebar;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-dark-elevated">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-purple">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        {!isCollapsed && (
          <span className="text-lg font-semibold text-text-primary tracking-tight">
            SkillTree
          </span>
        )}
        {/* Mobile close */}
        <button
          className="ml-auto lg:hidden text-text-secondary hover:text-text-primary"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
        {/* Desktop collapse */}
        <button
          className="ml-auto hidden lg:block text-text-secondary hover:text-text-primary transition-colors"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-accent-purple/10 text-accent-purple'
                  : 'text-text-secondary hover:bg-dark-elevated hover:text-text-primary'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn('h-5 w-5 shrink-0', active && 'text-accent-purple')} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      {!isCollapsed && (
        <div className="border-t border-dark-elevated px-4 py-3">
          <p className="text-xs text-text-muted">SkillTree v1.0</p>
          <p className="text-xs text-text-muted">Adaptive Learning Platform</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 z-50 h-full w-[280px] bg-dark-secondary border-r border-dark-elevated lg:hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 bg-dark-secondary border-r border-dark-elevated transition-all duration-300',
          isCollapsed ? 'lg:w-[68px]' : 'lg:w-[260px]'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
