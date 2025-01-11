import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const redirectPath = searchParams.get('redirect') || '/chatbot';

    if (token) {
      localStorage.setItem('auth_token', token);
      navigate(redirectPath);
    } else {
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