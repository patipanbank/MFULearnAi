import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import AuthGuard from './providers/AuthGuard';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import AdminLoginPage from '../pages/AdminLoginPage';
import AuthCallbackPage from '../pages/AuthCallbackPage';
import LogoutSuccessPage from '../pages/LogoutSuccessPage';
import Toast from '../shared/ui/Toast';
import Loading from '../shared/ui/Loading';

function App() {
  const location = useLocation();

  useEffect(() => {
    console.log('App: Current location =', location.pathname);
  }, [location]);


  return (
    <>
      <Toast />
      <Loading />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="/logout/success" element={<LogoutSuccessPage />} />

        {/* Protected Routes */}
        <Route element={<AuthGuard />}>
          <Route path="/dashboard" element={
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">Dashboard</h1>
                <p className="text-gray-600">You are authenticated!</p>
              </div>
            </div>
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<HomePage />} />
      </Routes>
    </>
  );
}

export default App;
