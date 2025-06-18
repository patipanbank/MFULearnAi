import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../../entities/user/store';

const AuthCallbackPage: React.FC = () => {
  const setToken = useAuthStore((state) => state.setToken);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const effectRan = useRef(false);

  useEffect(() => {
    // Due to StrictMode, this effect runs twice in development.
    // The ref ensures we only process the token and navigate once.
    if (effectRan.current === true) {
      return;
    }
    
    const token = searchParams.get('token');
    if (token) {
      effectRan.current = true;
      setToken(token);
      navigate('/chat', { replace: true });
    } else {
      // No token found, redirect to login with an error
      navigate('/login?error=token_missing', { replace: true });
    }
  }, [searchParams, setToken, navigate]);

  // Render a loading spinner while the effect is running and redirecting.
  return <div>Loading...</div>;
};

export default AuthCallbackPage; 