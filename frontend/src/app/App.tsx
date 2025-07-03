import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import AuthGuard from './providers/AuthGuard';
import Layout from '../shared/ui/Layout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import AdminLoginPage from '../pages/AdminLoginPage';
import AuthCallbackPage from '../pages/AuthCallbackPage';
import LogoutSuccessPage from '../pages/LogoutSuccessPage';
import ChatPage from '../pages/ChatPage';
import AgentPage from '../pages/AgentPage';
import SearchPage from '../pages/SearchPage';
import Toast from '../shared/ui/Toast';
import Loading from '../shared/ui/Loading';
import { useSettingsStore } from '../shared/stores/settingsStore';
import KnowledgePage from '../pages/KnowledgePage';

function App() {
  const location = useLocation();
  const { loadSettings, applyTheme, preferences } = useSettingsStore();

  // Initialize settings on app start
  useEffect(() => {
    console.log('App: Component mounted');
    
    // Load settings from API and apply theme
    const initializeApp = async () => {
      try {
        // TODO: The backend endpoint for settings needs to be implemented.
        // Temporarily disabled to prevent 404 errors.
        // await loadSettings();
        console.log('Settings loading disabled. Applying default theme:', preferences.theme);
        applyTheme(preferences.theme || 'light');
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Apply default theme if loading fails
        applyTheme('light');
      }
    };
    
    initializeApp();
    
    return () => {
      console.log('App: Component unmounted');
    };
  }, [loadSettings, applyTheme]);

  // Apply theme when preferences change
  useEffect(() => {
    console.log('Theme changed to:', preferences.theme);
    applyTheme(preferences.theme);
  }, [preferences.theme, applyTheme]);

  useEffect(() => {
    console.log('App: Current location =', location.pathname);
  }, [location]);


  return (
    <>
      <Toast />
      <Loading />
    <Routes>
      {/* Public Routes - No Layout */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth-callback" element={<AuthCallbackPage />} />
      <Route path="/logout/success" element={<LogoutSuccessPage />} />

      {/* Protected Routes with Layout */}
      <Route element={<AuthGuard />}>
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:chatId" element={<ChatPage />} />
              <Route path="/chat/history" element={<div className="p-6"><h1 className="text-2xl font-bold">Chat History</h1><p>Chat history will be implemented here</p></div>} />
              <Route path="/knowledgebase" element={<KnowledgePage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/search" element={<SearchPage />} />
              {/* Fallback */}
              <Route path="*" element={<ChatPage />} />
            </Routes>
          </Layout>
        } />
      </Route>
    </Routes>
    </>
  );
}

export default App;
