const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  console.log('User data from localStorage:', userData); // เพิ่ม log เพื่อตรวจสอบข้อมูล

  return (
    <header className="w-full text-right">
      <nav className="flex items-center justify-between px-6 py-4 w-full text-right">
        {/* Right Side: User Name - Updated with dark mode support */}
        <div className="ml-auto text-gray-600 dark:text-gray-300">
          {userData && (
            <span>
              {/*  */}
              ID:{userData.username} NAME:{userData.firstName} {userData.lastName}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
