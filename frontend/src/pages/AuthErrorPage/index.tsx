import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiHome, FiLogIn, FiRefreshCw } from 'react-icons/fi';

const AuthErrorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const error = searchParams.get('error') || 'unknown';
  const message = searchParams.get('message') || 'An authentication error occurred';

  useEffect(() => {
    // Auto redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleRetryLogin = () => {
    navigate('/login', { replace: true });
  };

  const handleReturnToHome = () => {
    navigate('/', { replace: true });
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const getErrorDetails = () => {
    switch (error) {
      case 'token_missing':
        return {
          title: 'Authentication Token Missing',
          description: 'The authentication token was not received from the SSO system.',
          suggestion: 'Please try logging in again.'
        };
      case 'saml_failed':
        return {
          title: 'SAML Authentication Failed',
          description: 'The SAML authentication process encountered an error.',
          suggestion: 'Please try again or contact support if the problem persists.'
        };
      case 'too_many_attempts':
        return {
          title: 'Too Many Login Attempts',
          description: 'You have exceeded the maximum number of login attempts.',
          suggestion: 'Please wait a few minutes before trying again.'
        };
      default:
        return {
          title: 'Authentication Error',
          description: message,
          suggestion: 'Please try logging in again or contact support.'
        };
    }
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Error Icon */}
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <FiAlertTriangle className="h-8 w-8 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {errorDetails.title}
          </h1>

          {/* Error Message */}
          <div className="mb-8">
            <p className="text-gray-600 mb-4">
              {errorDetails.description}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Suggestion:</strong> {errorDetails.suggestion}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleRetryLogin}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200 hover:scale-[1.02] shadow-lg"
            >
              <FiLogIn className="h-5 w-5 mr-2" />
              Try Again
            </button>

            <button
              onClick={handleRefresh}
              className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200"
            >
              <FiRefreshCw className="h-5 w-5 mr-2" />
              Refresh Page
            </button>

            <button
              onClick={handleReturnToHome}
              className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200"
            >
              <FiHome className="h-5 w-5 mr-2" />
              Go to Homepage
            </button>
          </div>

          {/* Auto redirect notice */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              You will be automatically redirected to login page in 10 seconds
            </p>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            🔧 Troubleshooting Tips:
          </h3>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Clear your browser cache and cookies</li>
            <li>2. Try using a different browser</li>
            <li>3. Check your internet connection</li>
            <li>4. Contact IT support if the problem persists</li>
          </ol>
        </div>

        {/* Error Code */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-800 mb-2">
            📋 Error Details:
          </h3>
          <div className="text-sm text-gray-700">
            <p><strong>Error Code:</strong> {error}</p>
            <p><strong>Message:</strong> {message}</p>
            <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthErrorPage; 