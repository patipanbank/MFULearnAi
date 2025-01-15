import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const response = await fetch('/api/auth/saml/callback-status');
        const data = await response.json();

        if (data.token && data.userData) {
          // บันทึกข้อมูลลง localStorage
          localStorage.setItem('token', data.token);
          localStorage.setItem('user_data', JSON.stringify({
            email: data.userData.email,
            first_name: data.userData.first_name,
            last_name: data.userData.last_name,
            groups: data.userData.groups
          }));

          // Debug: ตรวจสอบข้อมูลที่บันทึก
          console.log('Saved user data:', data.userData);
          
          navigate('/mfuchatbot');
        } else {
          console.error('Invalid authentication data');
          navigate('/login');
        }
      } catch (error) {
        console.error('Authentication callback error:', error);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 