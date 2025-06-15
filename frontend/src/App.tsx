import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

// Import pages from app directory
import ChatPage from '../app/chat/page';
import ModelsPage from '../app/models/page';
import CollectionsPage from '../app/collections/page';
import CollectionDetailPage from '../app/collections/[id]/page';
import DepartmentsPage from '../app/departments/page';
import AdminsPage from '../app/admins/page';
import SystemPromptPage from '../app/system-prompt/page';
import StatisticsPage from '../app/statistics/page';
import HelpPage from '../app/help/page';
import LoginPage from '../app/login/page';
import AuthCallbackPage from '../app/auth-callback/page';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20">
      <h1 className="text-2xl font-bold mb-4">404 - Not Found</h1>
      <p className="text-gray-600">The page you are looking for does not exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:id" element={<CollectionDetailPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/admins" element={<AdminsPage />} />
            <Route path="/system-prompt" element={<SystemPromptPage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth-callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
} 