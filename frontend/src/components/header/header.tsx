const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage และแปลงเป็น object
  const userDataString = localStorage.getItem('user_data');
  let userData = null;
  
  try {
    userData = userDataString ? JSON.parse(userDataString) : null;
    console.log('Parsed user data:', userData);
  } catch (error) {
    console.error('Error parsing user data:', error);
  }

  return (
    <header className="bg-white shadow">
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-800">MFU LEARN AI</h1>
        </div>
        
        {/* Right Side: User Name */}
        <div className="text-gray-600">
          {userData && (
            <span>
              {userData.first_name} {userData.last_name}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
