import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedGroups: string[];
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedGroups }) => {
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const userGroups = userData.groups || [];

  if (!userGroups.some((group: string) => allowedGroups.includes(group))) {
    return <Navigate to="/mfuchatbot" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard; 