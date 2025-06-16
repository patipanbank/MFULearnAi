import { useNavigate } from "react-router-dom";
// import { config } from "../config/config"; // Assuming config is not needed for now

const LoginPage = () => {
  const navigate = useNavigate();

  const handleSamlLogin = () => {
    // This will redirect to the backend endpoint that initiates SAML flow
    // Using a relative path which api.ts will prepend with the base URL
    window.location.href = 'http://localhost:8000/api/auth/login/saml'; // Kept the full URL as per sample
  };

  const handleAdminLogin = () => {
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" 
      style={{ backgroundImage: "url('/mfu_background_login.jpg')" }}>
      <div className="absolute inset-0 bg-white/50 dark:bg-black/30"></div>
      <div className="max-w-md w-full space-y-8 p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg relative z-10">
        <div className="text-center">
          <img src="/mfu_logo_chatbot.PNG" alt="MFU Logo" className="mx-auto h-24 w-auto mb-4" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
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
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Please login with your MFU account
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Your 24/7 AI Assistant for Mae Fah Luang University
          </p>
        </div>
        <div className="mt-8">
          <button
            onClick={handleSamlLogin}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Login with MFU SSO
          </button>
          <div className="mt-2 text-right">
            <button 
              onClick={handleAdminLogin}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white underline px-1 py-0.5 transition-colors duration-200"
            >
              admin login
            </button>
          </div>
        </div> 
      </div>
    </div>
  );
};

export default LoginPage; 