import { Outlet } from "react-router-dom";

const AdminPage = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminPage; 