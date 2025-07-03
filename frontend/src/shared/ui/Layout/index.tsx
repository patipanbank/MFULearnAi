import React, { useEffect, useCallback, useMemo } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileMenuOverlay from './MobileMenuOverlay';
import useLayoutStore from '../../stores/layoutStore';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showHeader?: boolean;
}

const Layout: React.FC<LayoutProps> = React.memo(({ 
  children, 
  showSidebar = true, 
  showHeader = true 
}) => {
  const { isMobile, mobileMenuOpen, sidebarCollapsed } = useLayoutStore();
  
  console.log('Layout - RENDER:', {
    showSidebar,
    showHeader,
    isMobile,
    mobileMenuOpen,
    sidebarCollapsed,
    timestamp: new Date().toISOString()
  });

  // Memoize store functions to prevent re-creation
  const { setIsMobile, setSidebarCollapsed } = useLayoutStore();

  // Handle responsive behavior - memoized
  const handleResize = useCallback(() => {
    const mobile = window.innerWidth < 768; // md breakpoint
    setIsMobile(mobile);
    
    // Auto-collapse sidebar on mobile
    if (mobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [setIsMobile, setSidebarCollapsed, sidebarCollapsed]);

  useEffect(() => {
    // Initial check
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Memoize mobile menu overlay to prevent unnecessary re-renders
  const mobileMenuOverlay = useMemo(() => {
    if (isMobile && showSidebar && mobileMenuOpen) {
      return <MobileMenuOverlay />;
    }
    return null;
  }, [isMobile, showSidebar, mobileMenuOpen]);

  // Memoize sidebar to prevent unnecessary re-renders
  const sidebar = useMemo(() => {
    if (showSidebar && !isMobile) {
      return <Sidebar />;
    }
    return null;
  }, [showSidebar, isMobile]);

  // Memoize header to prevent unnecessary re-renders
  const header = useMemo(() => {
    if (showHeader) {
      return <Header />;
    }
    return null;
  }, [showHeader]);

  return (
    <div className="h-screen flex bg-primary transition-colors duration-200">
      {/* Mobile Menu Components */}
      {mobileMenuOverlay}
      
      {/* Desktop Sidebar - Only show on desktop */}
      {sidebar}
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Always show for authenticated pages */}
        {header}
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
});

export default Layout; 