const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <header className="bg-white w-full text-right">
      <nav className="flex items-center justify-between px-6 py-4 w-full text-right">
        {/* Right Side: User Name */}
        <div className="ml-auto text-gray-600">
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
