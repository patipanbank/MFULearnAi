import api from './api';

// This is a mock implementation. Replace with actual API calls.
export const chatService = {
  sendMessage: async (message: string) => {
    const response = await api.post('/chat', { message });
    return response.data;
  },
}; 