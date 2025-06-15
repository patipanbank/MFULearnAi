import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleSamlLogin = () => {
    window.location.href = '/api/auth/login/saml'; // backend endpoint
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST' });
      if (!res.ok) throw new Error('Guest login failed');
      const data = await res.json();
      login(data.token, { ...data.user, role: 'Guest' });
      navigate('/');
    } catch (err) {
      alert('Guest login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full py-20">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded mb-2 w-60"
        onClick={handleSamlLogin}
        disabled={isLoading}
      >
        Login with MFU SSO (SAML)
      </button>
      <button
        className="px-4 py-2 bg-gray-300 text-gray-800 rounded w-60"
        onClick={handleGuestLogin}
        disabled={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Continue as Guest'}
      </button>
    </div>
  );
} 