import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';

const AuthGuard: React.FC = () => {
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.token);
  const fetchUser = useAuthStore((state) => state.fetchUser);

  // Prevent issuing multiple fetchUser calls during the same render loop.
  const isFetchingRef = useRef(false);

  useEffect(() => {
    console.log('AuthGuard: status =', status, 'token =', token ? 'present' : 'none', 'isFetching =', isFetchingRef.current);
    if (token && status === 'loading' && !isFetchingRef.current) {
      console.log('AuthGuard: Triggering fetchUser...');
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
    console.log('AuthGuard: Showing loading screen');
    return <div>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    console.log('AuthGuard: User unauthenticated, redirecting to login');
    // Redirect them to the /login page, but save the current location they were
    // trying to go to. This allows us to send them along to that page after they
    // log in, which is a nicer user experience than dropping them off on the home page.
    return <Navigate to="/login" replace />;
  }

  console.log('AuthGuard: User authenticated, rendering protected routes');

  return <Outlet />;
};

export default AuthGuard; 