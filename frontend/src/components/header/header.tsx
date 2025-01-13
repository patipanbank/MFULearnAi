import React, { useEffect, useState } from 'react';
import { User } from '../../types/user';

const Header: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // แกะข้อมูลจาก JWT token
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({
        email: payload.email,
        name: payload.displayName,
        username: payload.username
      });
    }
  }, []);

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">MFU Chatbot</h1>
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">Welcome, {user.name}</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
