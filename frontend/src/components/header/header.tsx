import React, { useEffect, useState } from 'react';
import { User } from '../../types/user';

const Header: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  return (
    <header className="w-full h-16 bg-white shadow-sm">
      <div className="h-full flex items-center px-4">
        <h1 className="text-xl font-semibold text-gray-800">MFU Chatbot</h1>
        
        {user && (
          <div className="flex items-center space-x-3 ml-auto">
            <span className="text-sm text-gray-700">{user.name}</span>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
              {user.name.charAt(0)}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
