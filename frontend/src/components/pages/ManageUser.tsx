import React, { useEffect, useMemo, useState } from 'react';
import { config } from '../../config/config';
import { FiLoader, FiRefreshCw, FiAlertCircle, FiEdit2, FiX, FiCheck, FiFilter, FiSearch, FiUsers } from 'react-icons/fi';
import { BaseModal } from '../models/ui/BaseModal';

interface User {
  _id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role: string;
}

interface Department {
  _id: string;
  name: string;
}

const ManageUser: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [search, setSearch] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/departments`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (err) {
      // Silently fail - departments filter is optional
      console.error('Failed to fetch departments:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply search filter
    const term = search.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((u) => {
        const values = [
          u.username,
          u.email,
          u.firstName,
          u.lastName,
          u.department,
          u.role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return values.includes(term);
      });
    }

    // Apply role filter
    if (filterRole) {
      filtered = filtered.filter((u) => u.role === filterRole);
    }

    // Apply department filter
    if (filterDepartment) {
      filtered = filtered.filter((u) => u.department === filterDepartment);
    }

    return filtered;
  }, [users, search, filterRole, filterDepartment]);

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      role: user.role,
    });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setFormData({});
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (
      !formData.username ||
      !formData.email ||
      !formData.firstName ||
      !formData.lastName ||
      !formData.department ||
      !formData.role
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/admin/users/${editingUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user');
      }

      // update local list
      setUsers((prev) =>
        prev.map((u) => (u._id === editingUser._id ? { ...u, ...(data.user as User) } : u)),
      );

      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating user');
    } finally {
      setSaving(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = users.length;
    const students = users.filter((u) => u.role === 'Students').length;
    const staffs = users.filter((u) => u.role === 'Staffs').length;
    const admins = users.filter((u) => u.role === 'Admin').length;
    return { total, students, staffs, admins };
  }, [users]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header Section */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FiUsers className="text-blue-600 dark:text-blue-400" />
            Manage Users
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and edit all users with their key details.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? <FiLoader className="mr-2 animate-spin" /> : <FiRefreshCw className="mr-2" />}
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FiUsers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Students</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.students}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-green-600 dark:text-green-400 font-semibold">S</span>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Staffs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.staffs}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <span className="text-purple-600 dark:text-purple-400 font-semibold">St</span>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admins</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.admins}</p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <span className="text-red-600 dark:text-red-400 font-semibold">A</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search username, email, name, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowFilterModal(true)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <FiFilter className="mr-2" />
            Filter
            {(filterRole || filterDepartment) && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                {(filterRole ? 1 : 0) + (filterDepartment ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Active Filters Display */}
        {(search || filterRole || filterDepartment) && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Active filters:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  Search: {search}
                  <button
                    onClick={() => setSearch('')}
                    className="hover:text-blue-600 dark:hover:text-blue-200"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterRole && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                  Role: {filterRole}
                  <button
                    onClick={() => setFilterRole('')}
                    className="hover:text-purple-600 dark:hover:text-purple-200"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filterDepartment && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Department: {filterDepartment}
                  <button
                    onClick={() => setFilterDepartment('')}
                    className="hover:text-green-600 dark:hover:text-green-200"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearch('');
                  setFilterRole('');
                  setFilterDepartment('');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit User: <span className="font-mono text-blue-600">{editingUser.username}</span>
            </h2>
            <button
              onClick={cancelEdit}
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <FiX className="mr-1.5" /> Cancel
            </button>
          </div>
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Username *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username || ''}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Department *
              </label>
              <select
                name="department"
                value={formData.department || ''}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Role *
              </label>
              <select
                name="role"
                value={formData.role || ''}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select role</option>
                <option value="Students">Students</option>
                <option value="Staffs">Staffs</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div className="md:col-span-2 mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <FiX className="mr-1.5" /> Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <FiLoader className="mr-1.5 animate-spin" /> : <FiCheck className="mr-1.5" />}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <BaseModal
          onClose={() => setShowFilterModal(false)}
          containerClasses="w-full max-w-lg"
        >
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Filter Users</h2>
            
            {/* Role Filter */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Filter by Role
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Roles</option>
                <option value="Students">Students</option>
                <option value="Staffs">Staffs</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Filter by Department
              </label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setFilterRole('');
                  setFilterDepartment('');
                }}
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </BaseModal>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          <FiAlertCircle className="h-5 w-5" />
          <div className="flex-1">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-sm underline decoration-red-400 hover:decoration-red-600"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <FiLoader className="animate-spin text-blue-600 h-8 w-8" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[14%]">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[20%]">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[14%]">
                    First Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[14%]">
                    Last Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[16%] hidden lg:table-cell">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[10%]">
                    Role
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[8%]">
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <FiUsers className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                          {search || filterRole || filterDepartment
                            ? 'No users found matching your filters'
                            : 'No users found'}
                        </p>
                        {(search || filterRole || filterDepartment) && (
                          <button
                            onClick={() => {
                              setSearch('');
                              setFilterRole('');
                              setFilterDepartment('');
                            }}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user._id}
                      className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                        {user.username}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white max-w-[180px] overflow-hidden text-ellipsis">
                        {user.email || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                        {user.firstName || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                        {user.lastName || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white hidden lg:table-cell max-w-[180px] truncate">
                        {user.department || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'Admin'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : user.role === 'Staffs'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          className="inline-flex items-center rounded-md border border-blue-500 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/30"
                        >
                          <FiEdit2 className="mr-1.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageUser;

