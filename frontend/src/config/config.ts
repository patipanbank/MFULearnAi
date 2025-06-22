// Get API URL from environment variables or use default
const getApiUrl = () => {
  // First try to get from Vite env
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Use secure protocol for production
  if (window.location.protocol === 'https:') {
    return `https://${window.location.host}`;
  }
  
  // Default for development
  return 'https://mfulearnai.mfu.ac.th';
};

// Get WebSocket URL from environment variables or use default
const getWsUrl = () => {
  // First try to get from Vite env
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // Use secure protocol for production
  if (window.location.protocol === 'https:') {
    return `wss://${window.location.host}/ws`;
  }
  
  // Default for development
  return 'wss://mfulearnai.mfu.ac.th/ws';
};

// Configuration object
export const config = {
  apiUrl: getApiUrl(),
  wsUrl: getWsUrl()
}; 