import { NavLink } from "react-router-dom";
import { FaHome, FaComments, FaUserShield } from "react-icons/fa";

const Sidebar = () => {
  const navLinks = [
    { to: "/", icon: <FaHome />, text: "Home" },
    { to: "/chat", icon: <FaComments />, text: "Chat" },
    { to: "/admin", icon: <FaUserShield />, text: "Admin" },
  ];

  return (
    <div className="w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col">
      <div className="p-4 text-2xl font-bold text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700">
        MFULearnAI
      </div>
      <nav className="mt-5 flex-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center py-3 px-4 mx-2 rounded-lg transition-colors duration-200 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isActive ? "bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-white" : ""
              }`
            }
          >
            <span className="text-xl">{link.icon}</span>
            <span className="ml-4 font-medium">{link.text}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {/* Can add user profile info here */}
      </div>
    </div>
  );
};

export default Sidebar; 