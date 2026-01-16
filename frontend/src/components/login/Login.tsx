import React from 'react';
// import { useNavigate } from 'react-router-dom';
import { config } from '../../config/config';
// import axios from 'axios';
const Login: React.FC = () => {
  // const [showLogin, setShowLogin] = useState(false);
  // const [name, setName] = useState('');
  const handleMFUSSOLogin = () => {
    window.location.href = `${config.apiUrl}/api/auth/login/saml`;
  };

  const handleAdminLogin = () => {
    window.location.href = import.meta.env.VITE_ADMIN_LOGIN_URL;
  };

  const handleGoogleLogin = () => {
    window.location.href = `${config.apiUrl}/api/auth/login/google`;
  };

  // const navigator = useNavigate();
  // const login_guest =  async() =>  {
  //   try {
  //     if (!name) {
  //       alert('Please enter your name');
  //       return;
  //     }
  //     const response = await axios.post(`${config.apiUrl}/api/auth/test`, {nameID: name});
      
  //     if (response.status !== 200) {
  //       throw new Error('Error logging in as guest');
  //     }
  //     setShowLogin(false);
  //     navigator(response.data)
  //   }
  //     catch (error) {
  //       console.error(error);
  //     }
  // }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" 
      style={{ backgroundImage: "url('/mfu_background_login.jpg')" }}>
      <div className="absolute inset-0 bg-white/50"></div>
      <div className="max-w-md w-full space-y-8 p-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg relative z-10">
        <div className="text-center">
          <img src="/mfu_logo_chatbot.PNG" alt="MFU Logo" className="mx-auto h-24 w-auto mb-4" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Login to <span style={{ 
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
          <p className="mt-2 text-sm text-gray-600">
            Please login with your MFU account
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Your 24/7 AI Assistant for Mae Fah Luang University
          </p>
        </div>
        <div className="mt-8">
          <button
            onClick={handleMFUSSOLogin}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Login with MFU SSO
          </button>
          
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 mt-4"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Login with Google
          </button>
          <div className="mt-2 text-right">
            <button 
              onClick={handleAdminLogin}
              className="text-xs text-gray-500 hover:text-black underline px-1 py-0.5 transition-colors duration-200"
            >
              admin login
            </button>
          </div>
        </div> 
        {/* <div className="mt-8">
          <button
            onClick={() => setShowLogin(true)}
            className='w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            Login with guest
          </button>
        </div> */}

      </div>
      {/* {showLogin && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center transition-opacity">
          <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-bold text-gray-900">
                Login as Guest
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Please enter your name
              </p>
            </div>
            <div className="mt-8">
              <input
                type="text"
                placeholder="Your Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="mt-8">
              <button
                onClick={() => login_guest()}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default Login; 