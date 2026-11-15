import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
}

interface AppState {
  sidebar: SidebarState;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  // Currently selected tree context
  activeTreeId: string | null;
  setActiveTreeId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebar: {
    isCollapsed: false,
    isMobileOpen: false,
  },
  toggleSidebar: () =>
    set((state) => ({
      sidebar: { ...state.sidebar, isCollapsed: !state.sidebar.isCollapsed },
    })),
  setSidebarCollapsed: (collapsed) =>
    set((state) => ({
      sidebar: { ...state.sidebar, isCollapsed: collapsed },
    })),
  setMobileOpen: (open) =>
    set((state) => ({
      sidebar: { ...state.sidebar, isMobileOpen: open },
    })),
  activeTreeId: null,
  setActiveTreeId: (id) => set({ activeTreeId: id }),
}));
