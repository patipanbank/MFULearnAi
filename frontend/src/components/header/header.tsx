import { useAuth } from "../../hooks/useAuth";
import DarkModeToggle from "../darkmode/DarkModeToggle";
import { FiLogOut } from "react-icons/fi";

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-md">
      <div>
        {/* We can add breadcrumbs or page titles dynamically here later */}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-700 dark:text-gray-300">
          Welcome, <span className="font-semibold">{user?.username}</span>
        </span>
        <DarkModeToggle />
        {user && (
          <button 
            onClick={logout}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            <FiLogOut />
            <span>Logout</span>
          </button>
        )}
      </div>
    </header>
  )
}

export default Header; 