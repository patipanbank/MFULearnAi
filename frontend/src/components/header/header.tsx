const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <header className="w-full text-right">
      <nav className="flex items-center justify-between px-6 py-4 w-fulltext-right">
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
