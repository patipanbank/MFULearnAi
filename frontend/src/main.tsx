import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './app/App.tsx';
import './index.css';

// Create a React Query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 408 (timeout)
        if (error?.status >= 400 && error?.status < 500 && error?.status !== 408) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnMount: 'always',
    },
    mutations: {
      retry: 1,
      onError: (error: any) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

// Initialize theme on app start
const initializeTheme = () => {
  const savedTheme = localStorage.getItem('applied-theme') as 'light' | 'dark' | 'auto' | null;
  const root = document.documentElement;
  
  if (savedTheme === 'auto' || !savedTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    
    // Listen for system theme changes when in auto mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('applied-theme') === 'auto' || !localStorage.getItem('applied-theme')) {
        root.classList.toggle('dark', e.matches);
      }
    };
    
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handleThemeChange);
    } else {
      mediaQuery.addEventListener('change', handleThemeChange);
    }
  } else {
    root.classList.toggle('dark', savedTheme === 'dark');
  }
};

// Initialize theme before rendering
initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
  </QueryClientProvider>
);
