import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import MainLayout from './components/layouts/MainLayout';
import MFUChatbot from './components/pages/mfuchatbot';
import TrainingDashboard from './components/pages/TrainingDashboard';
import Login from './components/login/Login';
import AuthCallback from './components/auth/AuthCallback';
import AuthGuard from './components/guards/AuthGuard';
import RoleGuard from './components/guards/RoleGuard';
import ModelCreation from './components/pages/modelCreation';
import './index.css';
 

const App = () => {
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
              <RoleGuard allowedRoles={['Staffs', 'Admin']}>
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
              <RoleGuard allowedRoles={['Staffs', 'Admin']}>
                <MainLayout>
                  <ModelCreation />
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
