import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const isCollapsed = useAppStore((s) => s.sidebar.isCollapsed);

  return (
    <div className="min-h-screen bg-dark-primary">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col transition-all duration-300',
          isCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[260px]'
        )}
      >
        <TopBar />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
