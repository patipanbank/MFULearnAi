import api from './api';

// This is a mock implementation. Replace with actual API calls.
export const authService = {
  // This is for Admin Login
  login: async (credentials: any) => {
    const response = await api.post('/auth/admin/login', credentials);
    return response.data;
  },

  guestLogin: async (credentials: { username: string; password: string }) => {
    const response = await api.post('/auth/guest-login', credentials);
    return response.data;
  },

  logout: async () => {
    // Logout is mostly a client-side state clearing operation
    return Promise.resolve();
  }
}; 