import { Link } from "react-router-dom";
import { FaUserCog, FaBuilding, FaChartBar, FaTerminal, FaBrain } from 'react-icons/fa';

const AdminDashboard = () => {
  const adminLinks = [
    { to: "manage-admins", title: "Manage Admins", description: "Add, remove, or edit administrator accounts.", icon: <FaUserCog /> },
    { to: "manage-departments", title: "Manage Departments", description: "Configure departments and their settings.", icon: <FaBuilding /> },
    { to: "statistics", title: "View Statistics", description: "Check usage statistics and analytics.", icon: <FaChartBar /> },
    { to: "system-prompt", title: "System Prompt", description: "Manage the global system prompt for the AI.", icon: <FaTerminal /> },
    { to: "training", title: "Training Dashboard", description: "Oversee and manage the AI training process.", icon: <FaBrain /> },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {adminLinks.map(link => (
        <Link to={link.to} key={link.to} className="block bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200">
          <div className="flex items-center gap-4">
            <span className="text-3xl text-blue-500">{link.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">{link.title}</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">{link.description}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default AdminDashboard; 