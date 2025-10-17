import React, { useState, useEffect } from 'react';
import { FiSearch, FiEdit, FiTrash2, FiEye, FiRefreshCw } from 'react-icons/fi';
import { useUIStore } from '../../stores';
import { AuthService } from '../../../services/api';
import type { User } from '../../types';
import UniversalModal from '../UniversalModal';

interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserData extends Omit<User, '_id'> {
  _id: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const AdminUserModal: React.FC<AdminUserModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [filters, setFilters] = useState({
    role: 'all',
    department: 'all',
    search: ''
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const { addToast } = useUIStore();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.role !== 'all' && { role: filters.role }),
        ...(filters.department !== 'all' && { department: filters.department }),
        ...(filters.search && { search: filters.search })
      };

      const response = await AuthService.getAdminUsers(params);

      setUsers(response.users as any);
      setPagination({
        page: pagination.page,
        limit: pagination.limit,
        total: response.total,
        pages: Math.ceil(response.total / pagination.limit)
      });
    } catch (error) {
      console.error('Failed to fetch users:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load users'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await AuthService.deleteAdminUser(userId);
      addToast({
        type: 'success',
        title: 'Success',
        message: 'User deleted successfully'
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete user'
      });
    }
  };

  const handleUpdateUser = async (userData: Partial<UserData>) => {
    if (!selectedUser) return;

    try {
      await AuthService.updateAdminUser(selectedUser._id, userData as any);
      addToast({
        type: 'success',
        title: 'Success',
        message: 'User updated successfully'
      });
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update user'
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, pagination.page, filters]);

  if (!isOpen) return null;

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      modalType="user-management"
      title="User Management"
      subtitle="Manage users, roles, and permissions"
    >
      <div className="flex flex-col h-full">

        {/* Filters and Search */}
        <div className="p-6 border-b border-border bg-secondary">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="pl-10 pr-4 py-2 w-full border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                className="px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              >
                <option value="all">All Roles</option>
                <option value="Students">Students</option>
                <option value="Staffs">Staffs</option>
                <option value="Admin">Admin</option>
                <option value="SuperAdmin">SuperAdmin</option>
              </select>

              <select
                className="px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
                value={filters.department}
                onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
              >
                <option value="all">All Departments</option>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Marketing">Marketing</option>
              </select>

              <button
                onClick={fetchUsers}
                className="btn-ghost p-2"
                disabled={loading}
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-secondary">Loading users...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user._id} className="card card-hover p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {(user.firstName || user.username).charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-primary">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.username}
                          </h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'SuperAdmin'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : user.role === 'Admin'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                              : user.role === 'Staffs'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-secondary">{user.email}</span>
                          {user.department && (
                            <span className="text-sm text-muted">• {user.department}</span>
                          )}
                          <span className="text-sm text-muted">• {user.username}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowEditModal(true);
                        }}
                        className="btn-ghost p-2 hover:!text-blue-600 hover:!bg-blue-50 dark:hover:!bg-blue-900/20"
                      >
                        <FiEdit className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user._id)}
                        className="btn-ghost p-2 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {users.length === 0 && !loading && (
                <div className="text-center py-8">
                  <FiEye className="h-12 w-12 mx-auto text-muted opacity-50" />
                  <p className="text-muted mt-2">No users found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-secondary">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="btn-ghost px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setPagination(prev => ({ ...prev, page }))}
                        className={`px-3 py-1 text-sm rounded ${
                          pagination.page === page
                            ? 'bg-blue-600 text-white'
                            : 'btn-ghost'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="btn-ghost px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <UserEditModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSave={handleUpdateUser}
        />
      )}
    </UniversalModal>
  );
};

// User Edit Modal Component
const UserEditModal: React.FC<{
  user: UserData;
  onClose: () => void;
  onSave: (data: Partial<UserData>) => void;
}> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email,
    department: user.department || '',
    role: user.role,
    tokenQuota: user.tokenQuota || 10000,
    dailyTokenLimit: user.dailyTokenLimit || 10000
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <UniversalModal
      isOpen={true}
      onClose={onClose}
      title="Edit User"
      size="lg"
      height="auto"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">First Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Last Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Department</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Role</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
            >
              <option value="Students">Students</option>
              <option value="Staffs">Staffs</option>
              <option value="Admin">Admin</option>
              <option value="SuperAdmin">SuperAdmin</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Token Quota</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
                value={formData.tokenQuota}
                onChange={(e) => setFormData(prev => ({ ...prev, tokenQuota: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Daily Limit</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-border rounded-lg bg-primary text-primary focus:ring-2 focus:ring-blue-500"
                value={formData.dailyTokenLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, dailyTokenLimit: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
    </UniversalModal>
  );
};

export default AdminUserModal;