import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userData = searchParams.get('user_data');

    if (token && userData) {
      // เก็บ token
      localStorage.setItem('auth_token', token);
      
      // เก็บข้อมูลผู้ใช้
      localStorage.setItem('user_data', userData);
      
      // redirect ไปที่หน้า MFUChatbot
      navigate('/mfuchatbot');
    } else {
      navigate('/login');
    }
  }, [navigate, searchParams]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-gray-600">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 