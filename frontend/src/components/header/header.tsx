
const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="flex justify-between items-center px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-800">MFU Learn AI</h1>
        
        {/* แสดงชื่อ-นามสกุลผู้ใช้ */}
        <div className="flex items-center">
          {userData && (
            <span className="text-gray-600">
              {userData.firstName} {userData.lastName}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
