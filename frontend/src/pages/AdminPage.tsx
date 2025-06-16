const AdminPage = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-2">Manage Admins</h2>
          <p>Add, remove, or edit administrator accounts.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-2">Manage Departments</h2>
          <p>Configure departments and their settings.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-2">View Statistics</h2>
          <p>Check usage statistics and analytics.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-2">System Prompt</h2>
          <p>Manage the global system prompt for the AI.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-2">Training Dashboard</h2>
          <p>Oversee and manage the AI training process.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPage; 