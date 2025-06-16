import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userString = searchParams.get('user');

    if (token && userString) {
      try {
        const user = JSON.parse(userString);
        login(user, token);
        navigate('/', { replace: true });
      } catch (error) {
        console.error("Failed to parse user data from callback", error);
        navigate('/login', { replace: true });
      }
    } else {
      console.error("Auth callback is missing token or user data.");
      navigate('/login', { replace: true });
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Please wait, authenticating...</p>
    </div>
  );
};

export default AuthCallback; 