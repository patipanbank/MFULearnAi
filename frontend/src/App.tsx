import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AuthGuard from './components/guards/AuthGuard';
import AdminPage from './pages/AdminPage';
import RoleGuard from './components/guards/RoleGuard';


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
          <Route index element={<HomePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route 
            path="admin" 
            element={
              <RoleGuard allowedRoles={['admin']}>
                <AdminPage />
              </RoleGuard>
            } 
          />
          {/* Add other routes here */}
        </Route>
      </Routes>
    </Router>
  )
}

export default App; 