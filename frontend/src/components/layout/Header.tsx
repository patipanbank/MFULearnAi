import React from 'react';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;
  const avatar = user?.username ? user.username[0].toUpperCase() : 'U';
  return (
    <header className="w-full h-16 flex items-center justify-between px-6 bg-white border-b shadow-sm">
      <div className="text-xl font-bold">MFULearnAi</div>
      <div className="flex items-center gap-4">
        {/* Placeholder for theme toggle */}
        <button className="p-2 rounded hover:bg-gray-100" title="Toggle theme">
          <span role="img" aria-label="theme">🌓</span>
        </button>
        {/* User info */}
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
            {avatar}
          </span>
          <span className="text-gray-700 font-medium">
            {isLoggedIn ? user?.username : 'Guest'}
          </span>
          {isLoggedIn && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5 ml-1">
              {user?.role}
            </span>
          )}
          {isLoggedIn && (
            <button
              className="ml-3 px-3 py-1 rounded bg-red-100 text-red-600 text-xs hover:bg-red-200"
              onClick={logout}
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
} 