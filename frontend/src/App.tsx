import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import MainLayout from './components/layouts/MainLayout';
import MFUChatbot from './components/pages/mfuchatbot';
import TrainingDashboard from './components/pages/TrainingDashboard';
import Login from './components/login/Login';
import AuthCallback from './components/auth/AuthCallback';
import AuthGuard from './components/guards/AuthGuard';
import RoleGuard from './components/guards/RoleGuard';
// import TrainingHistory from './components/pages/TrainingHistory';
import AdminLogin from './components/login/AdminLogin';
import './index.css';
 

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="/" element={<Navigate to="/mfuchatbot" replace />} />
        <Route path="/chat" element={<MFUChatbot />} />
        <Route path="/chat/:sessionId" element={<MFUChatbot />} />
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
              <RoleGuard allowedGroups={['Staffs']}>
                <MainLayout>
                  <TrainingDashboard />
                </MainLayout>
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['Admin']}>
                <MainLayout>
                  <TrainingDashboard />
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
      </Routes>
    </Router>
  );
};

export default App;
