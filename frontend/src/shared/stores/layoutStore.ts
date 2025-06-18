import { create } from 'zustand';

interface LayoutState {
  sidebarCollapsed: boolean;
  sidebarHovered: boolean;
  isMobile: boolean;
  mobileMenuOpen: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarHovered: (hovered: boolean) => void;
  setIsMobile: (mobile: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  
  // For future features
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Current page info
  currentPage: string;
  setCurrentPage: (page: string) => void;
  
  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  // Sidebar state
  sidebarCollapsed: false,
  sidebarHovered: false,
  isMobile: false,
  mobileMenuOpen: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarHovered: (hovered) => set({ sidebarHovered: hovered }),
  setIsMobile: (mobile) => set({ isMobile: mobile }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  toggleMobileMenu: () => set({ mobileMenuOpen: !get().mobileMenuOpen }),
  
  // Theme state
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  
  // Page state
  currentPage: '',
  setCurrentPage: (page) => set({ currentPage: page }),
  
  // Loading state
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}));

export default useLayoutStore; 