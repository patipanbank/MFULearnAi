import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Chat from './pages/Chat'
import Models from './pages/Models'
import Training from './pages/Training'
import Admin from './pages/Admin'
import Statistics from './pages/Statistics'
import Departments from './pages/Departments'
import Help from './pages/Help'
import NotFound from './pages/NotFound'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

const AppRoutes: React.FC = () => {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/auth-callback" element={<AuthCallback />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Navigate to="/chat" replace />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/chat" element={
        <ProtectedRoute>
          <Layout>
            <Chat />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/models" element={
        <ProtectedRoute>
          <Layout>
            <Models />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/training" element={
        <ProtectedRoute>
          <Layout>
            <Training />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin" element={
        <ProtectedRoute>
          <Layout>
            <Admin />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/statistics" element={
        <ProtectedRoute>
          <Layout>
            <Statistics />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/departments" element={
        <ProtectedRoute>
          <Layout>
            <Departments />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/help" element={
        <ProtectedRoute>
          <Layout>
            <Help />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
        },
      }}
    >
      <AuthProvider>
        <div className="App">
          <AppRoutes />
        </div>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App 