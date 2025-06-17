import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { Model } from '../utils/types';
import { useAuth } from '../../../hooks/useAuth';

interface EditModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: Model | null;
  onSave: (updatedModel: Partial<Model>) => Promise<void>;
  isLoading: boolean;
}

export const EditModelModal: React.FC<EditModelModalProps> = ({
  isOpen,
  onClose,
  model,
  onSave,
  isLoading
}) => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    modelType: 'personal' as 'official' | 'personal' | 'department',
    department: '',
    isAgent: false,
    prompt: '',
    displayRetrievedChunks: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (model) {
      setFormData({
        name: model.name || '',
        description: model.description || '',
        modelType: model.modelType || 'personal',
        department: model.department || '',
        isAgent: model.isAgent || false,
        prompt: model.prompt || '',
        displayRetrievedChunks: model.displayRetrievedChunks !== false
      });
    }
  }, [model]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Model name is required';
    }
    
    if (formData.modelType === 'department' && !formData.department.trim()) {
      newErrors.department = 'Department is required for department models';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving model:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen || !model) return null;

  const canChangeModelType = isAdmin || isSuperAdmin;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Model
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 
              rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                dark:bg-gray-700 dark:border-gray-600 dark:text-white
                ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
              placeholder="Enter model name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                dark:bg-gray-700 dark:text-white"
              placeholder="Enter model description"
            />
          </div>

          {/* Model Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model Type
            </label>
            <select
              value={formData.modelType}
              onChange={(e) => handleInputChange('modelType', e.target.value)}
              disabled={!canChangeModelType}
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                dark:bg-gray-700 dark:text-white
                ${!canChangeModelType ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="personal">Personal</option>
              {canChangeModelType && (
                <>
                  <option value="department">Department</option>
                  <option value="official">Official</option>
                </>
              )}
            </select>
            {!canChangeModelType && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Only admins can change model type
              </p>
            )}
          </div>

          {/* Department (only for department models) */}
          {formData.modelType === 'department' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Department *
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                  dark:bg-gray-700 dark:border-gray-600 dark:text-white
                  ${errors.department ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="Enter department name"
              />
              {errors.department && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.department}</p>
              )}
            </div>
          )}

          {/* Agent Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isAgent"
              checked={formData.isAgent}
              onChange={(e) => handleInputChange('isAgent', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 
                focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="isAgent" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Agent Mode
            </label>
          </div>

          {/* Display Retrieved Chunks Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="displayRetrievedChunks"
              checked={formData.displayRetrievedChunks}
              onChange={(e) => handleInputChange('displayRetrievedChunks', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 
                focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="displayRetrievedChunks" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Display Retrieved Chunks
            </label>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              System Prompt
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => handleInputChange('prompt', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                dark:bg-gray-700 dark:text-white"
              placeholder="Enter system prompt for the model"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 
                border border-transparent rounded-lg hover:bg-blue-700 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModelModal; 