import React from 'react';

const Header: React.FC = () => {
  // Get user data from localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  console.log('User data from localStorage:', userData); // เพิ่ม log เพื่อตรวจสอบข้อมูล

  return (
    <header className="w-full bg-white dark:bg-gray-800 border-b dark:border-gray-700">
      <div className="flex items-center justify-end px-6 py-3 max-w-[90rem] mx-auto">
        {userData && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {userData.firstName} {userData.lastName}
          </span>
        )}
      </div>
    </header>
  );
};

export default Header;
