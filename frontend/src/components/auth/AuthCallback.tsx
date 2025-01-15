import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (!code) {
          throw new Error('No code provided');
        }

        const response = await fetch('/api/auth/saml/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        const data = await response.json();
        
        // บันทึกข้อมูล token
        localStorage.setItem('auth_token', data.token);
        
        // บันทึกข้อมูลผู้ใช้
        localStorage.setItem('user_data', JSON.stringify({
          email: data.userData.email,
          first_name: data.userData.first_name,
          last_name: data.userData.last_name,
          groups: data.userData.groups
        }));

        console.log('Saved user data:', data.userData); // เพิ่ม log เพื่อตรวจสอบ

        navigate('/mfuchatbot');
      } catch (error) {
        console.error('Callback error:', error);
        navigate('/login');
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