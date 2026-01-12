import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../auth/store/userStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const { isAuthenticated, token } = useAuthStore();

  // Double check both store state and legacy check to prevent flash of login redirect
  const hasAuth = isAuthenticated || !!token || !!localStorage.getItem('auth_token');

  if (!hasAuth) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

export default AuthGuard; 