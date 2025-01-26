import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import MainLayout from './components/layouts/MainLayout';
import MFUChatbot from './components/pages/mfuchatbot';
import Login from './components/login/Login';
import AuthCallback from './components/auth/AuthCallback';
import AuthGuard from './components/guards/AuthGuard';
import RoleGuard from './components/guards/RoleGuard';
import TrainModel from './components/pages/TrainModel';
import ModelManagement from './components/admin/ModelManagement';
import './index.css';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="/" element={<Navigate to="/mfuchatbot" replace />} />
        <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
          <Route path="/mfuchatbot" element={<MFUChatbot />} />
          <Route path="/train" element={<RoleGuard allowedGroups={['Staffs']}><TrainModel /></RoleGuard>} />
          <Route path="/model-management" element={<RoleGuard allowedGroups={['Staffs']}><ModelManagement /></RoleGuard>} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
