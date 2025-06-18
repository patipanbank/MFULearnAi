import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';

interface RoleGuardProps {
  roles: string[];
}

const RoleGuard: React.FC<RoleGuardProps> = ({ roles }) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    // This case should theoretically not be hit if AuthGuard is working correctly,
    // but as a fallback, we redirect to login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const hasRequiredRole = roles.includes(user.role);

  if (!hasRequiredRole) {
    // Redirect to a more appropriate page, maybe the main chat page or a dedicated "unauthorized" page
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
};

export default RoleGuard; 