import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AuthGuard from './components/guards/AuthGuard';
import AdminPage from './pages/AdminPage';
import RoleGuard from './components/guards/RoleGuard';
import ManageAdminsPage from './pages/admin/ManageAdminsPage';
import AdminDashboard from './pages/admin/AdminDashboard';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/" 
          element={
            <AuthGuard>
              <MainLayout />
            </AuthGuard>
          }
        >
          <Route index element={<ChatPage />} />
          <Route 
            path="admin" 
            element={
              <RoleGuard allowedRoles={['admin']}>
                <AdminPage />
              </RoleGuard>
            } 
          >
            <Route index element={<AdminDashboard />} />
            <Route path="manage-admins" element={<ManageAdminsPage />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  )
}

export default App; 