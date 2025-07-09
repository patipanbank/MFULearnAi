import React from 'react';
import { config } from '../../config/config';
import { FiBookOpen, FiMessageCircle, FiZap, FiGlobe } from 'react-icons/fi';

const LoginPage: React.FC = () => {

  const handleMFUSSOLogin = () => {
    window.location.href = `${config.apiUrl}/api/v1/auth/login/saml`;
  };

  const handleAdminLogin = () => {
    window.location.href = '/admin/login';
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <FiMessageCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome to <span style={{ 
                background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>DIN</span>DIN <span style={{
                background: 'linear-gradient(to right, #00FFFF, #0099FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>AI</span>
            </h2>
            <p className="text-lg text-gray-600 mb-2">
              Your 24/7 AI Assistant
            </p>
            <p className="text-sm text-gray-500">
              Mae Fah Luang University
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 my-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <FiBookOpen className="h-6 w-6 text-blue-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Academic Support</p>
              <p className="text-xs text-gray-600">Get help with courses</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <FiZap className="h-6 w-6 text-cyan-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Instant Answers</p>
              <p className="text-xs text-gray-600">Quick responses</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <FiGlobe className="h-6 w-6 text-green-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Campus Info</p>
              <p className="text-xs text-gray-600">University resources</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <FiMessageCircle className="h-6 w-6 text-purple-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Smart Chat</p>
              <p className="text-xs text-gray-600">AI-powered conversations</p>
            </div>
          </div>

          {/* Login Button */}
          <div className="space-y-4">
            <button
              onClick={handleMFUSSOLogin}
              className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200 hover:scale-[1.02] shadow-lg hover:shadow-xl"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-6">
                <FiGlobe className="h-5 w-5" />
              </span>
              Login with MFU SSO
            </button>
            
            <div className="text-center">
              <button 
                onClick={handleAdminLogin}
                className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors duration-200 underline underline-offset-2"
              >
                Administrator Login
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4">
            <p className="text-xs text-gray-500">
              By logging in, you agree to our terms of service and privacy policy
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Background Image */}
      <div className="hidden lg:block flex-1 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/mfu_background_login.jpg')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-blue-900/20 to-cyan-900/20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
        
        {/* Overlay content */}
        <div className="relative h-full flex items-end p-12">
          <div className="text-white">
            <h3 className="text-2xl font-bold mb-4">
              Empowering Education with AI
            </h3>
            <p className="text-lg opacity-90 mb-2">
              Experience the future of academic assistance
            </p>
            <p className="text-sm opacity-75">
              Available 24/7 to support your learning journey
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 