import React, { useEffect } from 'react';
import { FiCheckCircle, FiHome, FiLogIn } from 'react-icons/fi';

const LogoutSuccessPage: React.FC = () => {
  useEffect(() => {
    // Auto redirect after 5 seconds
    const timer = setTimeout(() => {
      window.location.href = '/login';
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleReturnToLogin = () => {
    window.location.href = '/login';
  };

  const handleReturnToHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <FiCheckCircle className="h-8 w-8 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Logout Successful
          </h1>

          {/* Message */}
          <div className="mb-8">
            <p className="text-gray-600 mb-4">
              You have been successfully logged out from both DinDin AI and MFU SSO system.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Your SAML session has been terminated. 
                You will need to login again to access the system.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleReturnToLogin}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200 hover:scale-[1.02] shadow-lg"
            >
              <FiLogIn className="h-5 w-5 mr-2" />
              Login Again
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
              You will be automatically redirected to login page in 5 seconds
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">
            📋 If you came from SAML logout:
          </h3>
          <ol className="text-sm text-yellow-700 space-y-1">
            <li>1. ✅ Your SAML session has been terminated successfully</li>
            <li>2. ✅ You are now logged out from both DinDin AI and MFU SSO</li>
            <li>3. 🔄 Click "Login Again" to start a fresh session</li>
          </ol>
        </div>
        
        {/* Manual Navigation Help */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            💡 If you're still on the ADFS logout page:
          </h3>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Look for a "Return" or "Continue" button on that page</li>
            <li>2. Or manually navigate to: <code className="bg-blue-100 px-1 rounded">mfulearnai.mfu.ac.th</code></li>
            <li>3. Or bookmark this page for future reference</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default LogoutSuccessPage; 