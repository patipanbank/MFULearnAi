import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // SAML response จะถูกส่งมาโดยตรงผ่าน POST
        const response = await fetch('/api/auth/saml/callback', {
          method: 'POST',
          credentials: 'include', // สำคัญ! เพื่อให้ส่ง cookies ไปด้วย
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        const data = await response.json();
        console.log('Response data:', data); // Debug log

        // บันทึกข้อมูล token
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        
        // บันทึกข้อมูลผู้ใช้
        if (data.userData) {
          localStorage.setItem('user_data', JSON.stringify({
            email: data.userData.email,
            first_name: data.userData.first_name,
            last_name: data.userData.last_name,
            groups: data.userData.groups
          }));
          console.log('Saved user data:', data.userData);
        }

        navigate('/mfuchatbot');
      } catch (error) {
        console.error('Callback error:', error);
        // เพิ่ม delay ก่อน redirect เพื่อให้เห็น error
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 