import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userData = searchParams.get('user_data');
    const redirect = searchParams.get('redirect') || '/mfuchatbot';

    if (token && userData) {
      // บันทึก token และ user data ลง localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user_data', userData);
      
      // redirect ไปยังหน้าที่ต้องการ
      navigate(redirect);
    } else {
      // กรณีไม่มี token หรือ user data ให้กลับไปหน้า login
      navigate('/login');
    }
  }, [navigate, searchParams]);

  return <div>กำลังเข้าสู่ระบบ...</div>;
} 