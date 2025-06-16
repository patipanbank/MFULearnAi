import { Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import useAdminStore from "../../store/adminStore";
import { adminService } from "../../services/adminService";
import AddNewAdminModal from "../../components/modals/AddNewAdminModal";
import { FiArrowLeft, FiPlus, FiEdit, FiTrash2, FiUsers } from "react-icons/fi";

const ManageAdminsPage = () => {
  const { admins, isLoading, error, setAdmins, setLoading, setError } = useAdminStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const adminData = await adminService.getAdmins();
      setAdmins(adminData);
    } catch (e) {
      setError("Failed to fetch admins.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setAdmins, setLoading, setError]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const AdminTable = () => (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full leading-normal">
        <thead>
          <tr className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Username</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Email</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Created At</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {admins.map(admin => (
            <tr key={admin.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-5 py-4 bg-transparent text-sm">
                <p className="text-gray-900 dark:text-white whitespace-no-wrap">{admin.username}</p>
              </td>
              <td className="px-5 py-4 bg-transparent text-sm">
                <p className="text-gray-900 dark:text-white whitespace-no-wrap">{admin.email}</p>
              </td>
              <td className="px-5 py-4 bg-transparent text-sm">
                <p className="text-gray-900 dark:text-white whitespace-no-wrap">{new Date(admin.createdAt).toLocaleDateString()}</p>
              </td>
              <td className="px-5 py-4 bg-transparent text-sm">
                <div className="flex item-center space-x-3">
                  <button title="Edit" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors"><FiEdit /></button>
                  <button title="Delete" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 transition-colors"><FiTrash2 /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <FiUsers className="mx-auto text-5xl text-gray-400" />
      <h3 className="mt-2 text-xl font-medium text-gray-900 dark:text-white">No Administrators</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding a new administrator.</p>
    </div>
  );
  
  const LoadingSpinner = () => (
    <div className="text-center py-12">
      <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-blue-500 hover:underline mb-6">&larr; Back to Dashboard</Link>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Manage Administrators</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          <FiPlus />
          <span>Add New Admin</span>
        </button>
      </div>
      
      {isLoading ? <LoadingSpinner /> : (
        error ? <p className="text-red-500 text-center">{error}</p> : (
          admins.length > 0 ? <AdminTable /> : <EmptyState />
        )
      )}

      <AddNewAdminModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdminAdded={fetchAdmins}
      />
    </div>
  );
};

export default ManageAdminsPage; 