// import React,{useState} from 'react';
// import { useNavigate } from 'react-router-dom';
import { config } from '../../config/config';
// import axios from 'axios';
const Login: React.FC = () => {
  // const [showLogin, setShowLogin] = useState(false);
  // const [name, setName] = useState('');
  const handleMFUSSOLogin = () => {
    window.location.href = `${config.apiUrl}/api/auth/login/saml`;
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="relative max-w-md w-full mx-auto p-6">
        {/* Add logo as background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <img
            src="/public/mfu_logo_chatbot.PNG"
            alt="MFU Logo Background"
            className="w-64 h-64 object-contain"
          />
        </div>

        {/* Login content */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            Login to MFU Chatbot
          </h2>
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
    </div>
  );
};

export default Login; 