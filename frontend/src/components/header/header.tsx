const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <header className="bg-white border-b border-gray-200">
      <nav className="flex justify-between items-center px-6 py-4">
        {/* ชื่อแอพอยู่ซ้าย */}
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-800">MFU Learn AI</h1>
        </div>

        {/* ชื่อผู้ใช้อยู่ขวา */}
        <div className="flex-none">
          {userData && (
            <span className="text-gray-600">
              {userData.firstName} {userData.lastName}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
