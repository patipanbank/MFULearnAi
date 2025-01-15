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
      <div className="fixed top-0 left-0 right-0 bg-white border-b z-40">
        <div className="flex items-center px-4">
          <button
            className="p-2 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <FaBars className="h-6 w-6" />
          </button>
          <Header />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden pt-14">
        <div 
          className={`
            fixed inset-y-0 left-0 z-50 w-64 h-full bg-white transform transition-transform duration-300 ease-in-out
            lg:relative lg:translate-x-0 lg:flex-shrink-0 lg:h-screen
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <Sidebar />
        </div>

        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-45 lg:hidden pt-14"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 