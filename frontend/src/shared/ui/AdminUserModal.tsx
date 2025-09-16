import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiUsers, FiSearch, FiEdit, FiTrash2, FiPlus, FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';
import { useUIStore } from '../stores';
import { api } from '../lib/api';

interface User {
  _id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: 'SuperAdmin' | 'Admin' | 'Staffs' | 'Students';
  department?: string;
  groups?: string[];
  created: string;
  updated: string;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const AdminUserModal: React.FC<UserModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useUIStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    department: 'all'
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'Students' as User['role'],
    department: ''
  });

  const fetchUsers = useCallback(async (page = 1, resetFilters = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(resetFilters ? {} : {
          search: filters.search,
          role: filters.role,
          department: filters.department
        })
      });

      const response = await api.get<{
        users: User[];
        pagination: PaginationInfo;
      }>(`/admin/users?${params}`);

      setUsers(response.users);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch users'
      });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, addToast]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get<{ departments: Array<{ name: string; displayName: string }> }>('/admin/departments');
      setDepartments(response.departments.map(d => d.name));
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchUsers(1, true);
      fetchDepartments();
    }
  }, [isOpen, fetchUsers, fetchDepartments]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isOpen) {
        fetchUsers(1);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filters.search, fetchUsers, isOpen]);

  // Filter change handlers
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchUsers(newPage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username.trim()) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Username is required'
      });
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser._id}`, formData);
        addToast({
          type: 'success',
          title: 'Success',
          message: 'User updated successfully'
        });
      } else {
        await api.post('/admin/users', formData);
        addToast({
          type: 'success',
          title: 'Success',
          message: 'User created successfully'
        });
      }

      resetForm();
      await fetchUsers(pagination.page);
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save user'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role,
      department: user.department || ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      addToast({
        type: 'success',
        title: 'Success',
        message: 'User deleted successfully'
      });
      await fetchUsers(pagination.page);
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to delete user'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'Students',
      department: ''
    });
    setShowCreateForm(false);
    setEditingUser(null);
  };

  const roleColors = {
    SuperAdmin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    Admin: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    Staffs: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    Students: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <FiUsers className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold text-primary">User Management</h2>
              <p className="text-sm text-secondary">
                {pagination.total.toLocaleString()} total users
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(95vh-120px)]">
          {/* User List */}
          <div className="flex-1 flex flex-col">
            {/* Filters and Controls */}
            <div className="p-6 border-b border-border bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* Search */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-primary mb-1">
                    Search Users
                  </label>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
                    <input
                      type="text"
                      placeholder="Search by username, email, or name..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="input pl-10 w-full"
                    />
                  </div>
                </div>

                {/* Role Filter */}
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">
                    Role
                  </label>
                  <select
                    value={filters.role}
                    onChange={(e) => handleFilterChange('role', e.target.value)}
                    className="input w-full"
                  >
                    <option value="all">All Roles</option>
                    <option value="SuperAdmin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Staffs">Staffs</option>
                    <option value="Students">Students</option>
                  </select>
                </div>

                {/* Department Filter */}
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">
                    Department
                  </label>
                  <select
                    value={filters.department}
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                    className="input w-full"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchUsers(pagination.page)}
                    disabled={loading}
                    className="btn-ghost flex items-center space-x-2"
                  >
                    <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowCreateForm(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <FiPlus className="h-4 w-4" />
                  <span>Add User</span>
                </button>
              </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-4 font-medium text-primary">User</th>
                        <th className="text-left p-4 font-medium text-primary">Role</th>
                        <th className="text-left p-4 font-medium text-primary">Department</th>
                        <th className="text-left p-4 font-medium text-primary">Created</th>
                        <th className="text-right p-4 font-medium text-primary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id} className="border-b border-border hover:bg-muted/30">
                          <td className="p-4">
                            <div>
                              <div className="font-medium text-primary">
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.username
                                }
                              </div>
                              <div className="text-sm text-secondary">
                                {user.email || user.username}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4 text-secondary">
                            {user.department || '-'}
                          </td>
                          <td className="p-4 text-secondary">
                            {new Date(user.created).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleEdit(user)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                              >
                                <FiEdit className="h-4 w-4 text-muted" />
                              </button>
                              <button
                                onClick={() => handleDelete(user._id)}
                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              >
                                <FiTrash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-secondary">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total.toLocaleString()} users
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="btn-ghost p-2"
                    >
                      <FiChevronLeft className="h-4 w-4" />
                    </button>

                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm ${
                            pageNum === pagination.page
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted text-secondary'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="btn-ghost p-2"
                    >
                      <FiChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <div className="w-80 border-l border-border bg-muted/30">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">
                  {editingUser ? 'Edit User' : 'Create User'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="input w-full"
                      disabled={loading}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input w-full"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input w-full"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input w-full"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                      className="input w-full"
                      disabled={loading}
                    >
                      <option value="Students">Students</option>
                      <option value="Staffs">Staffs</option>
                      <option value="Admin">Admin</option>
                      <option value="SuperAdmin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Department
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="input w-full"
                      disabled={loading}
                    >
                      <option value="">No Department</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary flex-1"
                    >
                      {editingUser ? 'Update' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={loading}
                      className="btn-ghost flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserModal;