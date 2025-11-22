import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from '../shared/ui/Layout';
import HomePage from '../pages/HomePage';
import ChatPage from '../pages/ChatPage';
import AgentPage from '../pages/AgentPage';
import SearchPage from '../pages/SearchPage';
import AdminPage from '../pages/AdminPage';
import ProfilePage from '../pages/ProfilePage';
import Toast from '../shared/ui/Toast';
import Loading from '../shared/ui/Loading';
import { useSettingsStore } from '../shared/stores/settingsStore';
import KnowledgePage from '../pages/KnowledgePage';

function App() {
  const location = useLocation();
  const applyTheme = useSettingsStore((state) => state.applyTheme);
  const preferences = useSettingsStore((state) => state.preferences);

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
  }, [applyTheme, preferences.theme]);

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
      {/* All routes go directly to Layout - No login required */}
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/chat/history" element={<div className="p-6"><h1 className="text-2xl font-bold">Chat History</h1><p>Chat history will be implemented here</p></div>} />
            <Route path="/knowledgebase" element={<KnowledgePage />} />
            <Route path="/agent" element={<AgentPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* Fallback */}
            <Route path="*" element={<ChatPage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
    </>
  );
}

export default App;
