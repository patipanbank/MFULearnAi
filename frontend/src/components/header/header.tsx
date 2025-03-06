const Header = () => {
  // ดึงข้อมูลผู้ใช้จาก localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  // console.log('User data from localStorage:', userData); // เพิ่ม log เพื่อตรวจสอบข้อมูล

  return (
    <div className="flex-1 px-4">
      <div className="flex justify-end">
        <div className="text-gray-600 dark:text-gray-300">
          {userData && (
            <span>
              {/* {userData.username}  */}
              {userData.firstName} {userData.lastName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
