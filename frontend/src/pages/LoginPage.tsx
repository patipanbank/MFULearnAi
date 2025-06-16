import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import React, { useState } from "react";
import { authService } from "../services/authService";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('testuser');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { user, token } = await authService.login({ username, password });
      login(user, token);
      navigate("/", { replace: true });
    } catch (err) {
      setError('Failed to login. Please check your credentials.');
      console.error(err);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-800">
      <div className="p-8 bg-white dark:bg-gray-700 shadow-md rounded-lg">
        <h1 className="text-2xl font-bold text-center mb-4 dark:text-white">Login</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input 
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 dark:bg-gray-600 leading-tight focus:outline-none focus:shadow-outline" 
              id="username" 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input 
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 dark:bg-gray-600 mb-3 leading-tight focus:outline-none focus:shadow-outline" 
              id="password" 
              type="password" 
              placeholder="******************" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
          <div className="flex items-center justify-between">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="submit">
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage; 