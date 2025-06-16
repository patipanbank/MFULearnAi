import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import React, { useState } from "react";
import { authService } from "../services/authService";
import { FaUserShield } from "react-icons/fa";
import { FiUser, FiLock, FiLogIn } from "react-icons/fi";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('testuser');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { user, token } = await authService.login({ username, password });
      login(user, token);
      navigate("/", { replace: true });
    } catch (err) {
      setError('Failed to login. Please check your credentials.');
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 bg-white dark:bg-gray-800 shadow-2xl rounded-lg w-full max-w-md">
        <div className="text-center mb-8">
          <FaUserShield className="mx-auto text-5xl text-blue-600 dark:text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mt-4">Welcome Back!</h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in to access MFULearnAI</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              className="shadow-sm appearance-none border rounded w-full py-3 pl-10 pr-3 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500" 
              id="username" 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              className="shadow-sm appearance-none border rounded w-full py-3 pl-10 pr-3 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500" 
              id="password" 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div>
            <button 
              className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors disabled:bg-blue-400" 
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <FiLogIn />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </div>
          <div className="text-center">
            <a href="#" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Forgot Password?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage; 