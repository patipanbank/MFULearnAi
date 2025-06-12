import React, { useState, createContext, useContext } from 'react';
import Header from '../header/header';
import Sidebar from '../sidebar/sidebar';
import { FaBars } from 'react-icons/fa';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface SidebarContextType {
  isSidebarHovered: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  return (
    <SidebarContext.Provider value={{ isSidebarHovered }}>
      <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
        <div 
          className={`
            fixed top-0 left-0 z-40 h-full bg-white dark:bg-gray-800 transform transition-all duration-300 ease-in-out
            lg:relative lg:translate-x-0 lg:flex-shrink-0 border-r border-gray-200 dark:border-gray-700
            ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
            ${isSidebarHovered ? 'lg:w-64' : 'lg:w-16'}
            scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-700
          `}
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
        >
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        <div className="flex flex-col flex-1 w-full min-w-0">
          <div className={`fixed top-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-all duration-300 ${
            isSidebarHovered ? 'left-0 lg:left-64' : 'left-0 lg:left-16'
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

          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-45 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <main className={`flex-1 overflow-auto mt-16 bg-white dark:bg-gray-800 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-400 dark:scrollbar-track-gray-700 pb-4 transition-all duration-300 ${
            isSidebarHovered ? 'lg:ml-64' : 'lg:ml-16'
          }`}>
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default MainLayout; 