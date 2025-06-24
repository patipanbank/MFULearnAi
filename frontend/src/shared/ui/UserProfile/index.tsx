import React, { useRef, useEffect } from 'react';
import { FiLogOut } from 'react-icons/fi';
import useAuthStore from '../../../entities/user/store';
import useUIStore from '../../stores/uiStore';

const UserProfile: React.FC = () => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logoutSAML } = useAuthStore();
  const { openDropdowns, toggleDropdown, closeDropdown } = useUIStore();
  
  const dropdownId = 'user-profile';
  const isOpen = openDropdowns.has(dropdownId);

  // Debug user data
  console.log('UserProfile - Current user data:', user);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown(dropdownId);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown, dropdownId]);

  const handleCompleteLogout = () => {
    logoutSAML();
    closeDropdown(dropdownId);
  };

  if (!user) {
    return null;
  }

  // Extract first letter for avatar
  const avatarLetter = user.first_name?.charAt(0) || user.email?.charAt(0) || 'U';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => toggleDropdown(dropdownId)}
        className="btn-ghost flex items-center space-x-2 hover:bg-secondary transition-colors duration-200"
      >
        {/* Avatar */}
        <div className="h-8 w-8 bg-gradient-to-br from-red-500 to-amber-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {avatarLetter.toUpperCase()}
        </div>
        
        {/* User Info */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-primary">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-muted truncate max-w-32">
            {user.student_id || user.email}
          </p>
        </div>
      </button>

      {/* Dropdown Menu with Animation */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[320px] bg-primary border border-border rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* User Profile Header */}
          <div className="p-4 bg-gradient-to-r from-red-500 to-amber-500">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                {user.first_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {user.first_name} {user.last_name}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="p-4 space-y-6">
            {/* Email */}
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted">EMAIL</div>
                <div className="text-primary">{user.email}</div>
              </div>
            </div>

            {/* Department */}
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 21H21M3 18H21M9 18V13M15 18V13M4 10L12 3L20 10M6 10H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted">DEPARTMENT</div>
                <div className="text-primary">computer engineering</div>
              </div>
            </div>

            {/* Groups */}
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted">GROUPS</div>
                <div className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleCompleteLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
            >
              <FiLogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile; 