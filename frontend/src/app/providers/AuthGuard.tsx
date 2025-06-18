import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';

const AuthGuard: React.FC = () => {
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.token);

  // Prevent issuing multiple fetchUser calls during the same render loop.
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // Avoid spamming fetchUser when status is still 'loading'.
    if (token && status === 'loading' && !isFetchingRef.current) {
      isFetchingRef.current = true;
      // Use the promise resolution to reset the ref so it can be triggered again if needed.
      Promise.resolve(useAuthStore.getState().fetchUser()).finally(() => {
        isFetchingRef.current = false;
      });
    } else if (!token && status !== 'unauthenticated') {
      // Only update the store if the status actually needs to change.
      useAuthStore.setState({ status: 'unauthenticated' });
    }
  }, [token, status]);

  if (status === 'loading') {
    return <div>Loading...</div>; 
  }

  if (status === 'unauthenticated') {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to. This allows us to send them along to that page after they
    // log in, which is a nicer user experience than dropping them off on the home page.
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default AuthGuard; 