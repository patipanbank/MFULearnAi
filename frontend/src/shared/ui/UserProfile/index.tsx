import React, { useRef, useEffect } from 'react';
import { FiLogOut, FiMail, FiBook, FiUsers, FiCalendar, FiCreditCard } from 'react-icons/fi';
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

  // Extract initials for avatar
  const getInitials = () => {
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => toggleDropdown(dropdownId)}
        className="btn-ghost flex items-center space-x-2 hover:bg-secondary transition-colors duration-200"
      >
        {/* Avatar */}
        <div className="h-8 w-8 bg-gradient-to-br from-[rgb(186,12,47)] to-[rgb(212,175,55)] rounded-full flex items-center justify-center text-white text-sm font-medium">
          {getInitials()}
        </div>
        
        {/* User Info */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-primary">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted truncate max-w-32">
            {user.student_id || ''}
          </p>
        </div>
      </button>

      {/* Dropdown Menu with Animation */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[350px] bg-primary border border-border rounded-xl shadow-xl overflow-hidden animate-slide-in-from-bottom-2 duration-200">
          {/* User Profile Header */}
          <div className="p-4 bg-gradient-to-r from-[rgb(186,12,47)] to-[rgb(212,175,55)] animate-in fade-in duration-300 delay-75">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-2xl font-semibold animate-in fade-in zoom-in duration-300 delay-150">
                {getInitials()}
              </div>
              <div className="flex-1 animate-in fade-in slide-in-from-right-5 duration-300 delay-150">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </h3>
                  <p className="text-sm text-white/80">
                    {user.username || user.student_id || ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="p-4 space-y-4">
            {/* Student ID */}
            <div className="flex items-center space-x-3 animate-in fade-in slide-in-from-right-3 duration-300 delay-200">
              <div className="w-8 h-8 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <FiCreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted">STUDENT ID</div>
                <div className="text-sm font-medium text-primary">{user.student_id || 'N/A'}</div>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center space-x-3 animate-in fade-in slide-in-from-right-3 duration-300 delay-200">
              <div className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FiMail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted">EMAIL</div>
                <div className="text-sm font-medium text-primary">{user.email}</div>
              </div>
            </div>

            {/* Department */}
            <div className="flex items-center space-x-3 animate-in fade-in slide-in-from-right-3 duration-300 delay-300">
              <div className="w-8 h-8 flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FiBook className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted">DEPARTMENT</div>
                <div className="text-sm font-medium text-primary">{user.department_id?.$oid || 'Computer Engineering'}</div>
              </div>
            </div>

            {/* Groups */}
            <div className="flex items-center space-x-3 animate-in fade-in slide-in-from-right-3 duration-300 delay-[400ms]">
              <div className="w-8 h-8 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <FiUsers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted">GROUPS</div>
                <div className="mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>


          </div>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-border animate-in fade-in slide-in-from-bottom-2 duration-300 delay-500">
            <button
              onClick={handleCompleteLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium text-sm"
            >
              <FiLogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile; 