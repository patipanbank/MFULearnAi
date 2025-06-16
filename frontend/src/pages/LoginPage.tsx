import { useNavigate } from "react-router-dom";
import { FaUserShield, FaUserGraduate } from "react-icons/fa";

const LoginPage = () => {
  const navigate = useNavigate();

  const handleSamlLogin = () => {
    // This will redirect to the backend endpoint that initiates SAML flow
    window.location.href = 'http://localhost:8000/api/auth/saml/login';
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 bg-white dark:bg-gray-800 shadow-2xl rounded-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">Choose Your Login Method</h1>
        <div className="space-y-4">
          <button
            onClick={handleSamlLogin}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            <FaUserGraduate />
            <span>Login with MFU Account</span>
          </button>
          <button
            onClick={() => navigate('/admin/login')}
            className="w-full flex items-center justify-center gap-3 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            <FaUserShield />
            <span>Admin Login</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 