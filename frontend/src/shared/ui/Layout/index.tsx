import React, { useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileMenuOverlay from './MobileMenuOverlay';
import LayoutErrorBoundary from './LayoutErrorBoundary';
import useLayoutStore from '../../stores/layoutStore';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showHeader?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  showSidebar = true, 
  showHeader = true 
}) => {
  const { isMobile, mobileMenuOpen, setIsMobile, setSidebarCollapsed, sidebarCollapsed } = useLayoutStore();

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      
      // Auto-collapse sidebar on mobile
      if (mobile && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    };

    // Initial check
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile, setSidebarCollapsed, sidebarCollapsed]);

  return (
    <LayoutErrorBoundary>
      <div className="h-screen flex bg-primary transition-colors duration-200">
        {/* Mobile Menu Components */}
        {isMobile && showSidebar && mobileMenuOpen && <MobileMenuOverlay />}
        
        {/* Desktop Sidebar - Only show on desktop */}
        {showSidebar && !isMobile && <Sidebar />}
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - Always show for authenticated pages */}
          {showHeader && <Header />}
          
          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </LayoutErrorBoundary>
  );
};

export default Layout; 