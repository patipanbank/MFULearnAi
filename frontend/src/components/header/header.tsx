const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage และแปลงเป็น object
  const userDataString = localStorage.getItem('user_data');
  let userData = null;
  
  try {
    userData = userDataString ? JSON.parse(userDataString) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
  }

  return (
    <header className="w-full text-right">
      <nav className="flex items-center justify-between px-6 py-4 w-full text-right">
        {/* Right Side: User Name */}
        <div className="ml-auto text-gray-600">
          {userData && (
            <span>
              {userData.firstName} {userData.lastName}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
