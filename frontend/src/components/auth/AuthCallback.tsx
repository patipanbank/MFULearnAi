import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userData = searchParams.get('user_data');

    console.log('Received token:', token);
    console.log('Received user_data:', userData);

    if (token && userData) {
      // เก็บ token
      localStorage.setItem('auth_token', token);
      
      try {
        // ถ้า userData เป็น string ที่ถูก encode มา ต้อง decode ก่อน
        const decodedUserData = decodeURIComponent(userData);
        const parsedUserData = JSON.parse(decodedUserData);
        console.log('Parsed user data before saving:', parsedUserData);
        
        localStorage.setItem('user_data', JSON.stringify(parsedUserData));
      } catch (error) {
        console.error('Error processing user data:', error);
        // ถ้าไม่สามารถ parse ได้ ให้เก็บข้อมูลดิบไว้ก่อน
        localStorage.setItem('user_data', userData);
      }
      
      navigate('/mfuchatbot');
    } else {
      console.error('Missing token or user data');
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