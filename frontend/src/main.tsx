import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App.tsx';
import './index.css';

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
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
