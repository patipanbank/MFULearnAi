import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userDataBase64 = searchParams.get('user_data');
    const redirect = searchParams.get('redirect') || '/mfuchatbot';

    if (token && userDataBase64) {
      try {
        // แปลง base64 กลับเป็น JSON string
        const userDataStr = atob(userDataBase64);
        // แปลง JSON string เป็น object
        const userData = JSON.parse(userDataStr);

        // บันทึกข้อมูลลง localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        console.log('Token:', token);
        console.log('User Data:', userData);
        
        // redirect ไปยังหน้าที่ต้องการ
        navigate(redirect);
      } catch (error) {
        console.error('Error processing user data:', error);
        navigate('/login?error=invalid_data');
      }
    } else {
      navigate('/login?error=missing_data');
    }
  }, [navigate, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">กำลังเข้าสู่ระบบ...</h2>
        <p>กรุณารอสักครู่</p>
      </div>
    </div>
  );
} 