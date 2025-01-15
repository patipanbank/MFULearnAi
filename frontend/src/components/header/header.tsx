const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  
  // Debug: ตรวจสอบข้อมูลที่ได้จาก localStorage
  console.log('User data from localStorage:', userDataString);
  
  const userData = userDataString ? JSON.parse(userDataString) : null;

  // Debug: ตรวจสอบข้อมูลหลังแปลง JSON
  console.log('Parsed user data:', userData);

  return (
    <header className="bg-white w-full text-right">
      <nav className="flex items-center justify-between px-6 py-4 w-full text-right">
        <div className="ml-auto text-gray-600">
          {userData ? (
            <span>
              {userData.first_name} {userData.last_name}
            </span>
          ) : (
            <span>Loading...</span>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
