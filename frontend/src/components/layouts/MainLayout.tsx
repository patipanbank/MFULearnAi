import React from 'react';
import Header from '../header/header';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      <main className="h-[calc(100vh-3rem)]">
        {children}
      </main>
    </div>
  );
};

export default MainLayout; 