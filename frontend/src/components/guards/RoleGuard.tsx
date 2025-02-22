import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedGroups: string[];
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedGroups }) => {
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const userGroups = userData.groups || [];

  // Case-insensitive comparison
  const hasAllowedGroup = userGroups.some((userGroup: string) => 
    allowedGroups.some(allowedGroup => 
      allowedGroup.toLowerCase() === userGroup.toLowerCase()
    )
  );

  if (!hasAllowedGroup) {
    return <Navigate to="/mfuchatbot" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard; 