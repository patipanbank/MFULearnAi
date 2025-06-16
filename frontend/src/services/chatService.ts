import api from './api';

// This is a mock implementation. Replace with actual API calls.
export const chatService = {
  sendMessage: async (message: string) => {
    console.log('Sending message to API:', message);
    // In a real app, you would make an API call:
    // const response = await api.post('/chat', { message });
    // return response.data;

    // Mock response
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    return {
      id: (Date.now() + 1).toString(),
      text: `This is a mock response from API to: "${message}"`,
      sender: 'bot' as const,
      timestamp: new Date(),
    };
  },
}; 