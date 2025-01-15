import React, { useState } from 'react';
import Header from '../header/header';
import Sidebar from '../sidebar/sidebar';
import { FaBars } from 'react-icons/fa';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none z-10">
        <div className="flex items-center bg-white border-b px-4">
          <button
            className="p-2 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <FaBars className="h-6 w-6" />
          </button>
          <Header />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div 
          className={`
            fixed inset-y-0 left-0 z-30 w-64 bg-white transform transition-transform duration-300 ease-in-out
            lg:relative lg:translate-x-0 lg:flex-shrink-0
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <Sidebar />
        </div>

        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 