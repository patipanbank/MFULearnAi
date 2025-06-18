import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';

const HomePage: React.FC = () => {
  const { status, token, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('HomePage: Current status:', status, 'Token exists:', !!token);
    
    // If we have a token but status is still loading, fetch user data
    if (token && status === 'loading') {
      console.log('HomePage: Fetching user data...');
      fetchUser();
      return; // Wait for fetchUser to complete
    }
    
    // If we have a token and user is authenticated, redirect to chat
    if (token && status === 'authenticated') {
      console.log('HomePage: Redirecting to chat...');
      navigate('/chat', { replace: true });
    } 
    // If no token or unauthenticated, redirect to login
    else if (!token || status === 'unauthenticated') {
      console.log('HomePage: Redirecting to login...');
      navigate('/login', { replace: true });
    }
  }, [status, token, navigate, fetchUser]);

  // Show loading while determining auth status
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // This should not be reached as navigation will happen above
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="text-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
};

export default HomePage; 