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
      localStorage.setItem('auth_token', token);
      
      try {
        let parsedUserData;
        if (typeof userData === 'string') {
          // ถ้าเป็น string ให้แปลงเป็น object
          parsedUserData = JSON.parse(userData);
        } else {
          parsedUserData = userData;
        }
        
        console.log('Parsed user data before saving:', parsedUserData);
        
        if (Object.keys(parsedUserData).length === 0) {
          throw new Error('User data is empty');
        }
        
        localStorage.setItem('user_data', JSON.stringify(parsedUserData));
        navigate('/mfuchatbot');
      } catch (error) {
        console.error('Error processing user data:', error);
        navigate('/login?error=invalid_data');
      }
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