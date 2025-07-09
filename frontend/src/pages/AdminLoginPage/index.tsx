import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, apiUtils } from '../../shared/lib/api';
import { FiEye, FiEyeOff, FiLock, FiUser, FiShield, FiArrowLeft } from 'react-icons/fi';

const AdminLoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordError, setIsPasswordError] = useState(false);
  const [isUsernameError, setIsUsernameError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsPasswordError(false);
    setIsUsernameError(false);
    
    try {
      const response: any = await authApi.login({ username, password });

      localStorage.setItem('auth_token', response.token || response.accessToken);
      localStorage.setItem('user_data', JSON.stringify(response.user));
      
      navigate('/chat'); // Redirect to chat instead of mfuchatbot
    } catch (error: unknown) {
      const errorMessage = apiUtils.getErrorMessage(error);
      if (errorMessage.toLowerCase().includes('not found')) {
        setIsUsernameError(true);
      } else {
        setIsPasswordError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Left side - Admin Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Back button */}
          <div className="flex justify-start">
            <button
              onClick={handleBackToLogin}
              className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors duration-200 group"
            >
              <FiArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-0.5 transition-transform duration-200" />
              Back to main login
            </button>
          </div>

          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-slate-700 to-blue-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <FiShield className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Administrator Access
            </h2>
            <div className="text-xl font-semibold mb-4">
              <span style={{ 
                background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>DIN</span>DIN <span style={{
                background: 'linear-gradient(to right, #00FFFF, #0099FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>AI</span> Management
            </div>
            <p className="text-sm text-gray-600">
              Mae Fah Luang University
            </p>
          </div>

          {/* Login Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="relative">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                  {isUsernameError && (
                    <span className="text-red-500 ml-2 text-xs">• User not found</span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiUser className={`h-5 w-5 ${isUsernameError ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`block w-full pl-12 pr-4 py-3 border rounded-xl 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             bg-white backdrop-blur-sm transition-all duration-200
                             placeholder-gray-400 focus:outline-none shadow-sm
                             ${isUsernameError ? 'border-red-300 ring-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'}`}
                    placeholder="Enter your username"
                    required
                  />
                </div>
              </div>

              <div className="relative">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                  {isPasswordError && (
                    <span className="text-red-500 ml-2 text-xs">• Password is incorrect</span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiLock className={`h-5 w-5 ${isPasswordError ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`block w-full pl-12 pr-12 py-3 border rounded-xl 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             bg-white backdrop-blur-sm transition-all duration-200
                             placeholder-gray-400 focus:outline-none shadow-sm
                             ${isPasswordError ? 'border-red-300 ring-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'}`}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 
                             hover:text-gray-600 transition-colors duration-200"
                  >
                    {showPassword ? <FiEye className="h-5 w-5" /> : <FiEyeOff className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center items-center px-6 py-4 border border-transparent 
                         text-base font-medium rounded-xl text-white bg-gradient-to-r from-slate-700 to-blue-700 
                         hover:from-slate-800 hover:to-blue-800 focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200
                         transform hover:scale-[1.02] shadow-lg hover:shadow-xl
                         ${isLoading ? 'opacity-70 cursor-not-allowed scale-100' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <FiShield className="h-5 w-5 mr-2" />
                    Access Admin Panel
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <FiShield className="h-5 w-5 text-amber-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">
                  Authorized Access Only
                </h3>
                <p className="text-xs text-amber-700 mt-1">
                  This area is restricted to authorized administrators only. All access attempts are logged and monitored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Background */}
      <div className="hidden lg:block flex-1 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/mfu_background_login_admin.png')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-slate-900/30 to-blue-900/30"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        </div>
        
        {/* Overlay content */}
        <div className="relative h-full flex items-end p-12">
          <div className="text-white">
            <h3 className="text-2xl font-bold mb-4">
              Administrative Control Center
            </h3>
            <p className="text-lg opacity-90 mb-2">
              Manage and monitor AI assistant operations
            </p>
            <p className="text-sm opacity-75">
              Secure access to system administration tools
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage; 