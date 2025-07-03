import React from 'react';
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
  } else {
    root.classList.toggle('dark', savedTheme === 'dark');
  }
};

// Initialize theme before rendering
initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
