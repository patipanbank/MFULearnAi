const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <div className="flex items-center bg-white border-b px-4">
      {/* ส่วนของ MFU Learn AI */}
      <div className="flex-1">
        <h1 className="text-xl font-semibold text-gray-800">MFU Learn AI</h1>
      </div>

      {/* ส่วนของชื่อผู้ใช้ */}
      <div className="flex items-center pr-4">
        {userData && (
          <span className="text-gray-600 ml-auto">
            {userData.firstName} {userData.lastName}
          </span>
        )}
      </div>
    </div>
  );
};

export default Header;