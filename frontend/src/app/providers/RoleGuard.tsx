import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';
import { config } from '../../config/config';

interface RoleGuardProps {
  roles: string[];
}

const RoleGuard: React.FC<RoleGuardProps> = ({ roles }) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    // Login disabled - allow access anyway
    console.log('RoleGuard: No user, but allowing access (login disabled)');
    return <Outlet />;
  }

  const hasRequiredRole = roles.includes(user.role);

  if (!hasRequiredRole) {
    // Redirect to a more appropriate page, maybe the main chat page or a dedicated "unauthorized" page
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
};

export default RoleGuard; 