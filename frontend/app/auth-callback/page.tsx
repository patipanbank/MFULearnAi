import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const userDataEncoded = params.get('user_data');
      if (!token || !userDataEncoded) {
        setError('Missing token or user data');
        return;
      }
      const user = JSON.parse(atob(userDataEncoded));
      login(token, user);
      navigate('/', { replace: true });
    } catch (err) {
      setError('Authentication failed');
    }
  }, [login, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full py-20">
      <h1 className="text-2xl font-bold mb-4">Authenticating...</h1>
      <p className="text-gray-600">Processing your login. Please wait.</p>
    </div>
  );
} 