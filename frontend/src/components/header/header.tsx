import { useAuth } from "../../hooks/useAuth";
import DarkModeToggle from "../darkmode/DarkModeToggle";

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-md">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {user ? `Welcome, ${user.username}` : 'Welcome'}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <DarkModeToggle />
        {user && (
          <button 
            onClick={logout}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  )
}

export default Header; 