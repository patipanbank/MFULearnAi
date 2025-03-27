import React, { useState } from 'react';
import { config } from '../../config/config';
import Select from 'react-select';

const departments = [
  { value: 'Center for Information Technology Services', label: 'Center for Information Technology Services' },
  { value: 'Finance and Accounting Division', label: 'Finance and Accounting Division' },
  { value: 'Registrar Division', label: 'Registrar Division' },
  { value: 'Research Administration Division', label: 'Research Administration Division' },
  { value: 'Student Development Affairs Division', label: 'Student Development Affairs Division' },
  { value: 'MFU Sport Complex Centre', label: 'MFU Sport Complex Centre' },
  { value: 'Living and Learning Support Centre', label: 'Living and Learning Support Centre' },
  { value: 'Global Relations Division', label: 'Global Relations Division' },
  { value: 'Quality Assurance and Curriculum Development Division', label: 'Quality Assurance and Curriculum Development Division' },
  { value: 'Academic Extension and Development Office', label: 'Academic Extension and Development Office' },
  { value: 'Postgraduate Studies Office', label: 'Postgraduate Studies Office' },
  { value: 'Placement and Co-Operative Education Division', label: 'Placement and Co-Operative Education Division' },
  { value: 'Tea and Coffee Institute', label: 'Tea and Coffee Institute' },
  { value: 'Scientific and Technological Instruments Center', label: 'Scientific and Technological Instruments Center' },
  { value: 'Centre of Excellence in Fungal Research', label: 'Centre of Excellence in Fungal Research' }
];

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
          <Select
            value={departments.find(dept => dept.value === formData.department)}
            onChange={(selected) => setFormData({...formData, department: selected?.value || ''})}
            options={departments}
            placeholder=" Select department"
            isClearable
            className="react-select-container"
            styles={{
              control: (base) => ({
                ...base,
                minHeight: '42px',
                borderRadius: '0.5rem',
                borderColor: 'rgb(209 213 219)',
                backgroundColor: 'white',
                color: 'rgb(17 24 39)',
                '&:hover': {
                  borderColor: 'rgb(156 163 175)'
                },
                '.dark &': {
                  backgroundColor: 'rgb(55 65 81)',
                  borderColor: 'rgb(75 85 99)',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'rgb(107 114 128)'
                  }
                }
              }),
              input: (base) => ({
                ...base,
                color: 'rgb(17 24 39)',
                '.dark &': {
                  color: 'white'
                }
              }),
              menu: (base) => ({
                ...base,
                zIndex: 9999,
                backgroundColor: 'white',
                '.dark &': {
                  backgroundColor: 'rgb(55 65 81)',
                  color: 'white'
                }
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? 'rgb(59 130 246)' : 'transparent',
                color: state.isFocused ? 'white' : 'inherit',
                '&:hover': {
                  backgroundColor: 'rgb(59 130 246)',
                  color: 'white'
                },
                '.dark &': {
                  backgroundColor: state.isFocused ? 'rgb(59 130 246)' : 'transparent',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgb(59 130 246)',
                    color: 'white'
                  }
                }
              }),
              singleValue: (base) => ({
                ...base,
                color: 'rgb(17 24 39)',
                '.dark &': {
                  color: 'white'
                }
              }),
              placeholder: (base) => ({
                ...base,
                color: 'rgb(107 114 128)',
                '.dark &': {
                  color: 'rgb(156 163 175)'
                }
              }),
              dropdownIndicator: (base) => ({
                ...base,
                color: 'rgb(107 114 128)',
                '.dark &': {
                  color: 'rgb(156 163 175)'
                }
              }),
              clearIndicator: (base) => ({
                ...base,
                color: 'rgb(107 114 128)',
                '.dark &': {
                  color: 'rgb(156 163 175)'
                }
              }),
              multiValue: (base) => ({
                ...base,
                backgroundColor: 'rgb(59 130 246)',
                color: 'white',
                '.dark &': {
                  backgroundColor: 'rgb(59 130 246)',
                  color: 'white'
                }
              }),
              multiValueLabel: (base) => ({
                ...base,
                color: 'white'
              }),
              multiValueRemove: (base) => ({
                ...base,
                color: 'white',
                ':hover': {
                  backgroundColor: 'rgb(37 99 235)',
                  color: 'white'
                }
              })
            }}
            theme={(theme) => ({
              ...theme,
              colors: {
                ...theme.colors,
                primary: '#3B82F6',
                primary75: '#60A5FA',
                primary50: '#93C5FD',
                primary25: '#BFDBFE',
              },
            })}
          />
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