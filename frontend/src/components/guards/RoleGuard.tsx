import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface RoleGuardProps {
  allowed: string[];
  children: React.ReactNode;
}

export default function RoleGuard({ allowed, children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && (!user || !allowed.includes(user.role))) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, allowed, navigate]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-2xl font-bold mb-4">Checking permissions...</h1>
      </div>
    );
  }

  if (!allowed.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-red-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
} 