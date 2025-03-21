import React, { useState, useEffect } from 'react';
import Header from '../header/header';
import Sidebar from '../sidebar/sidebar';
import { FaBars } from 'react-icons/fa';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // ตรวจจับการเปลี่ยนแปลงขนาดหน้าจอเพื่อปรับ state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* Sidebar for desktop */}
      <div 
        className={`
          fixed top-0 left-0 z-40 h-full bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out
          w-[280px] border-r border-gray-200 dark:border-gray-700
          ${isMobile ? (isSidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0 relative'}
          scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-700
        `}
      >
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div className={`flex flex-col flex-1 w-full min-w-0 ${!isMobile ? 'ml-[280px]' : ''}`}>
        <div className="fixed top-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 left-0 lg:left-[280px]">
          <div className="flex items-center px-4 h-16">
            <button
              className="p-2 mr-2 lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <FaBars className="h-5 w-5 dark:text-gray-200" />
            </button>
            <Header />
          </div>
        </div>

        {/* Overlay เมื่อเปิด sidebar บนมือถือ */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-35"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-auto pt-16 pb-4 bg-white dark:bg-gray-800 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-700">
          <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 