import React from 'react';
const Login: React.FC = () => {

  const handleAdminLogin = () => {
    window.location.href = '/admin/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ backgroundImage: "url('/mfu_background_login.jpg')" }}>
      <div className="absolute inset-0 bg-white/50"></div>
      <div className="max-w-md w-full space-y-8 p-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg relative z-10">
        <div className="text-center">
          <img src="/mfu_logo_chatbot.PNG" alt="MFU Logo" className="mx-auto h-24 w-auto mb-4" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Login to{' '}
            <span className="bg-gradient-to-r from-orange-500 to-yellow-400 bg-clip-text text-transparent">
              DIN
            </span>
            <span className="text-black">DIN</span>{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              AI
            </span>
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please login with your MFU account
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Your 24/7 AI Assistant for Mae Fah Luang University
          </p>
        </div>
        <div className="mt-8">
          <div className="space-y-4">
            <button
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login/google`}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-300 shadow-sm transition-all transform hover:-translate-y-0.5 duration-200"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="w-5 h-5"
              />
              <span>Sign in with Google</span>
            </button>

            <button
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login/saml`}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 bg-gradient-to-r from-mfu-red to-mfu-red-dark hover:from-red-700 hover:to-red-900 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 duration-200"
            >
              Login with MFU SSO
            </button>
          </div>
          <div className="mt-2 text-right">
            <button
              onClick={handleAdminLogin}
              className="text-xs text-gray-500 hover:text-black underline px-1 py-0.5 transition-colors duration-200"
            >
              admin login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 