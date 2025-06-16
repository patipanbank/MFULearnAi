import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    // Redirect them to the home page if they don't have the required role
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard; 