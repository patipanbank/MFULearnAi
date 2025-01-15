const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <header className="bg-white w-full">
      <nav className="flex items-center justify-end px-6 py-4">
        <div className="text-gray-600">
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
