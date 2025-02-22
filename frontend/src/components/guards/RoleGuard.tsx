import { Navigate } from 'react-router-dom';

type UserRole = 'Admin' | 'Staffs' | 'Students';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const userGroups = userData.groups || [];

  console.log('RoleGuard check:', {
    userGroups,
    allowedRoles,
    userData
  });

  const hasAllowedRole = allowedRoles.some(role => 
    userGroups.includes(role) || 
    (role === 'Staffs' && userGroups.includes('Admin')) // Admin can do anything Staffs can do
  );

  if (!hasAllowedRole) {
    return <Navigate to="/mfuchatbot" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard; 