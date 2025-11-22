import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';
import { config } from '../../config/config';

const AuthGuard: React.FC = () => {
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.token);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const setToken = useAuthStore((state) => state.setToken);

  // Prevent issuing multiple fetchUser calls during the same render loop.
  const isFetchingRef = useRef(false);

  // Bypass authentication in development mode (localhost)
  // Mock user should already be set in store initialization, but ensure it's set here too
  useEffect(() => {
    if (config.isDevelopment && (!token || status === 'unauthenticated')) {
      console.log('AuthGuard: Development mode detected, ensuring mock authentication is set');
      const currentState = useAuthStore.getState();
      if (!currentState.token || currentState.status === 'unauthenticated') {
        // Set a mock token and user for development directly (don't use setToken to avoid triggering fetchUser)
        const mockToken = 'dev-mock-token';
        localStorage.setItem('auth_token', mockToken);
        
        // Set mock user directly
        useAuthStore.setState({
          token: mockToken,
          status: 'authenticated',
          user: {
            _id: { $oid: 'dev-user-id' },
            id: 'dev-user-id',
            nameID: 'dev-user',
            username: 'dev-user',
            email: 'dev@localhost.local',
            firstName: 'Development',
            lastName: 'User',
            department: 'Development',
            role: 'Students',
            groups: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        });
      }
    }
  }, [config.isDevelopment, token, status]);

  useEffect(() => {
    console.log('AuthGuard: status =', status, 'token =', token ? 'present' : 'none', 'isFetching =', isFetchingRef.current);
    if (token && status === 'loading' && !isFetchingRef.current) {
      // Skip fetchUser in development mode if we already have a mock user
      if (config.isDevelopment && useAuthStore.getState().user) {
        console.log('AuthGuard: Development mode - skipping fetchUser, using mock user');
        return;
      }
      console.log('AuthGuard: Triggering fetchUser...');
      isFetchingRef.current = true;
      fetchUser().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [token, status, fetchUser]);

  useEffect(() => {
    if (!token && status !== 'unauthenticated' && !config.isDevelopment) {
      // Only update the store if the status actually needs to change.
      useAuthStore.setState({ status: 'unauthenticated' });
    }
  }, [token, status]);

  // In development mode, always allow access (mock user should be set)
  if (config.isDevelopment) {
    console.log('AuthGuard: Development mode - allowing access');
    return <Outlet />;
  }

  if (status === 'loading') {
    console.log('AuthGuard: Showing loading screen');
    return <div>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    console.log('AuthGuard: User unauthenticated, but allowing access (login disabled)');
    // Login disabled - allow access anyway
    return <Outlet />;
  }

  console.log('AuthGuard: User authenticated, rendering protected routes');

  return <Outlet />;
};

export default AuthGuard; 