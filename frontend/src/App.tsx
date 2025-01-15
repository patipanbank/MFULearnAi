import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import MainLayout from './components/layouts/MainLayout';
import MFUChatbot from './components/pages/mfuchatbot';
import Login from './components/login/Login';
import AuthCallback from './components/auth/AuthCallback';
import AuthGuard from './components/guards/AuthGuard';
import TrainAI from './components/pages/trainAi';
import RoleGuard from './components/guards/RoleGuard';
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
          path="/train-ai"
          element={
            <AuthGuard>
              <RoleGuard allowedGroups={['Admin']}>
                <MainLayout>
                  <TrainAI />
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
