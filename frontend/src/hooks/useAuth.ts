import { useState, useEffect } from 'react';

interface User {
  username: string;
  role: string;
  groups?: string[];
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
}

export const useAuth = (): AuthState => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isStaff: false,
    isAdmin: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const user = {
          username: tokenPayload.username,
          role: tokenPayload.role,
          groups: tokenPayload.groups,
        };
        setState({
          user,
          isLoading: false,
          isStaff: tokenPayload.role === 'Staffs' || tokenPayload.role === 'Admin',
          isAdmin: tokenPayload.role === 'Admin',
        });
      } catch (error) {
        console.error('Error parsing auth token:', error);
        setState({
          user: null,
          isLoading: false,
          isStaff: false,
          isAdmin: false,
        });
      }
    } else {
      setState({
        user: null,
        isLoading: false,
        isStaff: false,
        isAdmin: false,
      });
    }
  }, []);

  return state;
}; 