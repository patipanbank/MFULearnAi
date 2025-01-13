import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    console.log('Received token:', token);

    if (token) {
      try {
        localStorage.setItem('auth_token', token);
        console.log('Token stored successfully');
        navigate('/dashboard');
      } catch (error) {
        console.error('Error storing token:', error);
        navigate('/login');
      }
    } else {
      console.log('No token received');
      navigate('/login');
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 