import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spin } from 'antd';

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userDataStr = searchParams.get('user_data');

    if (token && userDataStr) {
      try {
        const samlUser = JSON.parse(userDataStr);
        
        // Create a user object that matches the application's User interface
        const appUser = {
          ...samlUser,
          role: 'user', // Assign role for SAML users
        };

        login(appUser, token);
        
        // Redirect to the originally intended page, or home
        const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/';
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath, { replace: true });

      } catch (error) {
        console.error("Failed to parse user data from URL.", error);
        // Navigate to login with an error message
        navigate('/login?error=invalid_token', { replace: true });
      }
    } else {
      console.error("Auth callback is missing token or user data in URL params.");
      // Navigate to login with an error message
      navigate('/login?error=no_token', { replace: true });
    }
  }, [searchParams, login, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <Spin size="large" />
      <p style={{ marginTop: '20px' }}>Authenticating, please wait...</p>
    </div>
  );
};

export default AuthCallbackPage; 