import React, { useState } from 'react';
import Header from '../header/header';
import Sidebar from '../sidebar/sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      <div className="flex h-[calc(100vh-3rem)]">
        {/* Sidebar - hidden on mobile, visible on lg screens */}
        <div className="hidden lg:block w-64 border-r border-gray-200 dark:border-gray-700">
          <Sidebar />
        </div>
        
        {/* Mobile Sidebar */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-gray-900/50" onClick={() => setIsSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-xl">
              <Sidebar onClose={() => setIsSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 