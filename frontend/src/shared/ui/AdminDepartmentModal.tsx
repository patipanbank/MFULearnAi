import React, { useState, useEffect } from 'react';
import { FiX, FiBuilding, FiUsers, FiPlus, FiEdit, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { useUIStore } from '../stores';
import { api } from '../lib/api';

interface Department {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  userCount: number;
  isActive: boolean;
  parentDepartment?: string;
  level: number;
  created: string;
  updated: string;
}

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminDepartmentModal: React.FC<DepartmentModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useUIStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ departments: Department[] }>('/admin/departments?includeInactive=true');
      setDepartments(response.departments);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch departments'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.displayName.trim()) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Name and display name are required'
      });
      return;
    }

    setLoading(true);
    try {
      if (editingDepartment) {
        // Update existing department
        await api.put(`/admin/departments/${editingDepartment._id}`, formData);
        addToast({
          type: 'success',
          title: 'Success',
          message: 'Department updated successfully'
        });
      } else {
        // Create new department
        await api.post('/admin/departments', formData);
        addToast({
          type: 'success',
          title: 'Success',
          message: 'Department created successfully'
        });
      }

      setFormData({ name: '', displayName: '', description: '' });
      setShowCreateForm(false);
      setEditingDepartment(null);
      await fetchDepartments();
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save department'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      displayName: department.displayName,
      description: department.description || ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (departmentId: string) => {
    if (!confirm('Are you sure you want to deactivate this department?')) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/admin/departments/${departmentId}`);
      addToast({
        type: 'success',
        title: 'Success',
        message: 'Department deactivated successfully'
      });
      await fetchDepartments();
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to deactivate department'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setLoading(true);
    try {
      await api.post('/admin/departments/recalculate');
      addToast({
        type: 'success',
        title: 'Success',
        message: 'User counts recalculated successfully'
      });
      await fetchDepartments();
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to recalculate user counts'
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelForm = () => {
    setFormData({ name: '', displayName: '', description: '' });
    setShowCreateForm(false);
    setEditingDepartment(null);
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <FiBuilding className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-primary">Department Management</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Department List */}
          <div className="flex-1 flex flex-col">
            {/* Controls */}
            <div className="p-6 border-b border-border">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRecalculate}
                    disabled={loading}
                    className="btn-ghost flex items-center space-x-2"
                  >
                    <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>Recalculate</span>
                  </button>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>Add Department</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Department List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredDepartments.map((department) => (
                    <div key={department._id} className="card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            department.isActive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                          }`}>
                            <FiBuilding className={`h-5 w-5 ${
                              department.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-medium text-primary">{department.displayName}</h3>
                            <p className="text-sm text-secondary">{department.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEdit(department)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                          >
                            <FiEdit className="h-4 w-4 text-muted" />
                          </button>
                          {department.userCount === 0 && (
                            <button
                              onClick={() => handleDelete(department._id)}
                              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <FiTrash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FiUsers className="h-4 w-4 text-muted" />
                          <span className="text-sm text-secondary">
                            {department.userCount} users
                          </span>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          department.isActive
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                        }`}>
                          {department.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </div>

                      {department.description && (
                        <p className="text-sm text-secondary mt-2 line-clamp-2">
                          {department.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <div className="w-80 border-l border-border bg-muted/30">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">
                  {editingDepartment ? 'Edit Department' : 'Create Department'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Department Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., computer-science"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted mt-1">
                      Internal name (lowercase, no spaces)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., Computer Science"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input w-full h-20 resize-none"
                      placeholder="Optional description..."
                      disabled={loading}
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary flex-1"
                    >
                      {editingDepartment ? 'Update' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelForm}
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

export default AdminDepartmentModal;