import React from 'react';

const Login: React.FC = () => {
  const handleMFUSSOLogin = () => {
    window.location.href = 'http://localhost:5000/api/auth/login/saml';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Login to MFU Chatbot
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please login with your MFU account
          </p>
        </div>
        <div className="mt-8">
          <button
            onClick={handleMFUSSOLogin}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Login with MFU SSO
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login; 