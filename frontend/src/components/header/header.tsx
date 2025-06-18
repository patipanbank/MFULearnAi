import { useState } from 'react';
import { FaSignOutAlt, FaEnvelope, FaBuilding, FaUsers, FaChevronDown } from 'react-icons/fa';
import { config } from '../../config/config';
import { Link } from 'react-router-dom';
// import { useNavigate } from 'react-router-dom'; // ลบออกเพราะไม่ได้ใช้

const Header = () => {
  // const navigate = useNavigate(); // ลบออกเพราะไม่ได้ใช้
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  // เพิ่ม state สำหรับควบคุมการแสดง/ซ่อนป็อปอัพ
  const [showPopup, setShowPopup] = useState(false);

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

  // console.log('User data from localStorage:', userData); // เพิ่ม log เพื่อตรวจสอบข้อมูล

  // Function to generate user initials for avatar
  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Function to generate avatar background style with gradient
  const getAvatarStyle = () => {
    return {
      background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))'
    };
  };

  return (
    <header className="w-full">
      <nav className="flex items-center justify-between px-6 py-4 w-full">
        {/* DINDIN AI branding on the left */}
        <div className="flex items-center">
          <Link to="/mfuchatbot">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white cursor-pointer">
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
          </Link>
        </div>

        {/* User info on the right */}
        <div className="text-gray-600 dark:text-gray-300 relative">
          {userData && (
            <>
              <div 
                onClick={() => setShowPopup(!showPopup)}
                className="cursor-pointer flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                {/* Avatar */}
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold select-none" 
                  style={{
                    ...getAvatarStyle(),
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    userSelect: 'none'
                  }}
                >
                  {getUserInitials(userData.firstName, userData.lastName)}
                </div>
                
                {/* Name and chevron */}
                <div className="flex items-center gap-2">
                  <span className="hidden md:inline font-medium select-none" style={{ 
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    userSelect: 'none'
                  }}>
                    {userData.firstName} {userData.lastName}
                  </span>
                  <FaChevronDown className={`w-3 h-3 transition-transform duration-200 ${showPopup ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* ป็อปอัพแสดงรายละเอียด */}
              {showPopup && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                                     {/* Header section */}
                   <div 
                     className="p-6 text-white"
                     style={{ background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))' }}
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold bg-white/20 backdrop-blur-sm">
                         {getUserInitials(userData.firstName, userData.lastName)}
                       </div>
                      <div>
                        <h3 className="text-lg font-semibold">{userData.firstName} {userData.lastName}</h3>
                        <p className="text-blue-100 text-sm">{userData.username}</p>
                      </div>
                    </div>
                  </div>

                  {/* User details section */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                      <FaEnvelope className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</p>
                        <p className="text-sm font-medium">{userData.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                      <FaBuilding className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Department</p>
                        <p className="text-sm font-medium">{userData.department}</p>
                      </div>
                    </div>

                    {userData.groups && userData.groups.length > 0 && (
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                        <FaUsers className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Groups</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {userData.groups.map((group: string, index: number) => (
                              <span 
                                key={index}
                                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full"
                              >
                                {group}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Logout button */}
                  <div className="px-6 pb-6">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-all duration-200 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 group"
                    >
                      <FaSignOutAlt className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Sign Out</span>
                    </button>
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
