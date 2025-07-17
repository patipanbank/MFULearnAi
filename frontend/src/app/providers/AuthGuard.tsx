import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';

const AuthGuard: React.FC = () => {
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.token);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const location = useLocation();

  // Prevent issuing multiple fetchUser calls during the same render loop.
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (token && status === 'loading' && !isFetchingRef.current) {
      isFetchingRef.current = true;
      fetchUser().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [token, status, fetchUser]);

  useEffect(() => {
    if (!token && status !== 'unauthenticated') {
      // Only update the store if the status actually needs to change.
      useAuthStore.setState({ status: 'unauthenticated' });
    }
  }, [token, status]);

  if (status === 'loading') {
    return <div>Loading...</div>; 
  }

  if (status === 'unauthenticated') {
    // Check if user is already on a public route to prevent redirect loop
    const publicRoutes = ['/login', '/admin/login', '/auth/callback', '/auth-callback', '/logout/success'];
    const isOnPublicRoute = publicRoutes.includes(location.pathname);
    
    if (isOnPublicRoute) {
      // User is already on a public route, don't redirect
      return <Outlet />;
    }
    
    // Redirect them to the /login page, but save the current location they were
    // trying to go to. This allows us to send them along to that page after they
    // log in, which is a nicer user experience than dropping them off on the home page.
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default AuthGuard; 