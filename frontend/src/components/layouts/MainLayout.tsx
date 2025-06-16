import React, { useState, useEffect } from 'react';
import Header from '../header/header';
import Sidebar from '../sidebar/sidebar';
import { FaBars } from 'react-icons/fa';
import { useUIStore } from '../chat/store/uiStore';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isSidebarHovered, setIsSidebarHovered, isSidebarPinned, initMobileDetection } = useUIStore();

  // Determine if sidebar should be expanded (either hovered or pinned)
  const isSidebarExpanded = isSidebarHovered || isSidebarPinned;

  useEffect(() => {
    initMobileDetection();
  }, [initMobileDetection]);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* Sidebar - Always fixed positioned */}
      <div 
        className={`
          fixed top-0 left-0 z-40 h-full bg-white dark:bg-gray-800 transform transition-all duration-300 ease-in-out
          border-r border-gray-200 dark:border-gray-700
          ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarExpanded ? 'lg:w-64' : 'lg:w-16'}
          scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-700
        `}
        onMouseEnter={() => !isSidebarPinned && setIsSidebarHovered(true)}
        onMouseLeave={() => !isSidebarPinned && setIsSidebarHovered(false)}
      >
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main content container - Full width with padding to avoid sidebar overlap */}
      <div className="flex flex-col w-full min-w-0">
        {/* Header - Fixed positioned with padding to avoid sidebar overlap */}
        <div className={`fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isSidebarExpanded ? 'lg:pl-64' : 'lg:pl-16'
        }`}>
          <div className="flex items-center px-4 h-16">
            <button
              className="p-2 lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <FaBars className="h-6 w-6 dark:text-gray-200" />
            </button>
            <Header />
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content - Full width with padding to avoid sidebar overlap */}
        <main className={`flex-1 overflow-auto mt-16 bg-white dark:bg-gray-800 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-700 pb-4 transition-all duration-300 ${
          isSidebarExpanded ? 'lg:pl-64' : 'lg:pl-16'
        }`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 