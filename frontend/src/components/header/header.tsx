
const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center w-full">
          {/* ชื่อแอพทางซ้าย */}
          <div>
            <h1 className="text-xl font-semibold text-gray-800">MFU Learn AI</h1>
          </div>

          {/* ชื่อผู้ใช้ทางขวา */}
          <div>
            {userData && (
              <span className="text-gray-600">
                {userData.firstName} {userData.lastName}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;