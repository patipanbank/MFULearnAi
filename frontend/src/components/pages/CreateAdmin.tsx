import React, { useState } from 'react';
import { config } from '../../config/config';

const CreateAdmin: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    department: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/admin/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Error creating admin');
      }

      setSuccess(true);
      setFormData({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        email: '',
        department: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating admin');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Create New Admin
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Username
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            First Name
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Last Name
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Department
          </label>
          <select
            value={formData.department}
            onChange={(e) => setFormData({...formData, department: e.target.value})}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          >
            <option value="">Select Department</option>
            <option value="Center for Information Technology Services">Center for Information Technology Services</option>
            <option value="Finance and Accounting Division">Finance and Accounting Division</option>
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
            Create Admin Success
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 
            hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200
            transform hover:scale-[1.02] shadow-md hover:shadow-lg disabled:opacity-50"
        >
          {isLoading ? 'Creating Admin...' : 'Create Admin'}
        </button>
      </form>
    </div>
  );
};

export default CreateAdmin; 