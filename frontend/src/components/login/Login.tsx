import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { FaGoogle } from 'react-icons/fa';

const Login: React.FC = () => {
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: tokenResponse.access_token })
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('auth_token', data.token);
          window.location.href = '/chatbot';
        } else {
          throw new Error('Login failed');
        }
      } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login');
      }
    },
    onError: () => {
      alert('An error occurred during login');
    },
    flow: 'implicit',
    scope: 'email profile',
    hosted_domain: 'mfu.ac.th',
    prompt: 'select_account'
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Login to MFU Chatbot
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please login with your MFU email
          </p>
        </div>
        <div className="mt-8">
          <button
            onClick={() => login()}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaGoogle className="w-5 h-5 mr-2" />
            Login with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login; 