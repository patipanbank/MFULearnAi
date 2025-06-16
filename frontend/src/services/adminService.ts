// import api from './api';

const mockAdmins = [
  { id: '1', username: 'admin1', email: 'admin1@example.com', role: 'admin' as const, createdAt: new Date().toISOString() },
  { id: '2', username: 'superadmin', email: 'superadmin@example.com', role: 'admin' as const, createdAt: new Date().toISOString() },
];

// This is a mock implementation. Replace with actual API calls.
export const adminService = {
  getAdmins: async () => {
    console.log('Fetching admins from API...');
    // const response = await api.get('/admins');
    // return response.data;
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return Promise.resolve(mockAdmins);
  },
}; 