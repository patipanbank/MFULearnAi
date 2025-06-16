import { Outlet } from "react-router-dom";
import Sidebar from "../components/sidebar/sidebar";
import Header from "../components/header/header";
import useUIStore from "../store/uiStore";
import { useEffect } from "react";

const MainLayout = () => {
  const isDarkMode = useUIStore((state) => state.isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 dark:bg-gray-800 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout; 