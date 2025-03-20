import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import MainLayout from './components/layouts/MainLayout';
import MFUChatbot from './components/pages/mfuchatbot';
import TrainingDashboard from './components/pages/TrainingDashboard';
import Login from './components/login/Login';
import AuthCallback from './components/auth/AuthCallback';
import AuthGuard from './components/guards/AuthGuard';
import RoleGuard from './components/guards/RoleGuard';
import ModelCreation from './components/pages/modelCreation';
import './index.css';
import AdminLogin from './components/login/AdminLogin';
import CreateAdmin from './components/pages/CreateAdmin';
import Help from './components/pages/Help';
import Statistics from './components/pages/Statistics';
import useChatWebSocketStore from './store/useChatWebSocketStore';
 
const App = () => {
  const { initializeWebSocket } = useChatWebSocketStore();
  
  // Initialize WebSocket connection when the app starts
  useEffect(() => {
    // Check if user is authenticated before initializing WebSocket
    const token = localStorage.getItem('auth_token');
    if (token) {
      initializeWebSocket();
    }
  }, [initializeWebSocket]);
  
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="/" element={<Navigate to="/mfuchatbot" replace />} />
        <Route
          path="/mfuchatbot"
          element={
            <AuthGuard>
              <MainLayout>
                <MFUChatbot />
              </MainLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/training"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['Staffs', 'Admin', 'Students', 'SuperAdmin']}>
              {/* <RoleGuard allowedGroups={['Admin']}> */}
                <MainLayout>
                  <TrainingDashboard />
                </MainLayout>
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route
          path="/modelCreation"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['Staffs', 'Admin', 'Students', 'SuperAdmin']}>
              {/* <RoleGuard allowedGroups={['Admin']}> */}
                <MainLayout>
                  <ModelCreation />
                </MainLayout>
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        {/* <Route
          path="/admin/dashboard"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['SuperAdmin']}>
                <MainLayout>
                  <TrainingDashboard />
                </MainLayout>
              </RoleGuard>
            </AuthGuard>
          }
        /> */}
        <Route
          path="/admin/create"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['SuperAdmin']}>
                <MainLayout>
                  <CreateAdmin />
                </MainLayout>
              </RoleGuard>
            </AuthGuard>
          }
        />
        {/* <Route
          path="/training-history"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['Staffs']}>
                <MainLayout>
                  <TrainingHistory />
                </MainLayout>
              </RoleGuard>
            </AuthGuard>
          }
        /> */}
        <Route
          path="/help"
          element={
            <AuthGuard>
              <MainLayout>
                <Help />
              </MainLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/statistics"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['SuperAdmin']}>
                <MainLayout>
                  <Statistics />
                </MainLayout>
              </RoleGuard>
            </AuthGuard>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
