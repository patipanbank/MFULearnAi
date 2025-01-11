import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import MainLayout from './components/layouts/MainLayout';
import MFUChatbot from './components/pages/mfuchatbot';
import Login from './components/login/Login';
import AuthCallback from './components/auth/AuthCallback';
import './index.css';

const App: React.FC = () => {
  const isAuthenticated = !!localStorage.getItem('auth_token');

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/chatbot" /> : <Login />} 
          />
          <Route path="/auth-callback" element={<AuthCallback />} />
          <Route
            path="/*"
            element={
              isAuthenticated ? (
                <MainLayout>
                  <Routes>
                    <Route path="/chatbot" element={<MFUChatbot />} />
                    <Route path="/" element={<Navigate to="/chatbot" />} />
                  </Routes>
                </MainLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
};

export default App;
