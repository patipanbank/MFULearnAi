import { useState } from 'react';
import { FaSignOutAlt } from 'react-icons/fa';
import { config } from '../../config/config';
// import { useNavigate } from 'react-router-dom'; // ลบออกเพราะไม่ได้ใช้

const Header = () => {
  // const navigate = useNavigate(); // ลบออกเพราะไม่ได้ใช้
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  // เพิ่ม state สำหรับควบคุมการแสดง/ซ่อนป็อปอัพ
  const [showPopup, setShowPopup] = useState(false);

  // console.log('User data from localStorage:', userData); // เพิ่ม log เพื่อตรวจสอบข้อมูล

  const handleLogout = async () => {
    try {
      localStorage.clear();
      document.cookie = "MSISAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      // Open login page in new tab
      window.open('https://mfulearnai.mfu.ac.th/login', '_blank');
      // Then redirect current tab to SAML logout
      window.location.href = `${config.apiUrl}/api/auth/logout/saml`;
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  return (
    <header className="w-full">
      <nav className="flex items-center justify-between px-6 py-4 w-full">
        {/* DINDIN AI branding on the left */}
        <div className="flex items-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            <span style={{
              background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>DIN</span>{''}
            <span>DIN</span>
            <span style={{
              background: 'linear-gradient(to right, #00FFFF, #0099FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}> AI</span>
          </h2>
        </div>

        {/* User info on the right */}
        <div className="text-gray-600 dark:text-gray-300 relative">
          {userData && (
            <>
              <div 
                onClick={() => setShowPopup(!showPopup)}
                className="cursor-pointer px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span>
                  {/* {userData.username}  */}
                  {userData.firstName} {userData.lastName}
                </span>
              </div>

              {/* ป็อปอัพแสดงรายละเอียด */}
              {showPopup && (
                <div className="absolute right-0 mt-2 min-w-max max-w-xs bg-white dark:bg-gray-700 rounded-lg shadow-lg p-3 sm:p-4 z-50">
                  <div className="space-y-2 text-left">
                    <p className="text-xs sm:text-sm whitespace-nowrap"><span className="font-semibold">Name:</span> {userData.firstName} {userData.lastName}</p>
                    <p className="text-xs sm:text-sm whitespace-nowrap"><span className="font-semibold">ID:</span> {userData.username}</p>
                    <p className="text-xs sm:text-sm whitespace-nowrap"><span className="font-semibold">Email:</span> {userData.email}</p>
                    <p className="text-xs sm:text-sm whitespace-nowrap"><span className="font-semibold">Department:</span> {userData.department}</p>
                    <p className="text-xs sm:text-sm whitespace-nowrap"><span className="font-semibold">Group:</span> {userData.groups?.join(', ')}</p>
                    
                    {/* Logout button */}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors text-xs sm:text-sm"
                      >
                        <FaSignOutAlt className="w-4 h-4 mr-2" />
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
