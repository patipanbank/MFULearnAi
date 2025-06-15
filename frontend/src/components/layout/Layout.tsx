import React, { useState, useEffect } from 'react'
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button, Badge, Modal, Typography } from 'antd'
import { 
  MessageOutlined, 
  UserOutlined, 
  SettingOutlined, 
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  BookOutlined,
  BarChartOutlined,
  TeamOutlined,
  QuestionCircleOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  BellOutlined
} from '@ant-design/icons'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = AntLayout
const { Text } = Typography

interface LayoutProps {
  children: React.ReactNode
}

const LayoutComponent: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [sessionWarningVisible, setSessionWarningVisible] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const location = useLocation()
  const navigate = useNavigate()
  const { 
    user, 
    logout, 
    isAdmin, 
    isSuperAdmin, 
    hasPermission,
    token
  } = useAuth()

  // Session monitoring
  useEffect(() => {
    if (!token) return

    const checkSession = () => {
      try {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]))
        const expiryTime = tokenPayload.exp * 1000
        const currentTime = Date.now()
        const timeLeft = expiryTime - currentTime
        
        // Show warning if less than 5 minutes remaining
        if (timeLeft > 0 && timeLeft <= 5 * 60 * 1000) {
          setTimeRemaining(Math.floor(timeLeft / 1000))
          setSessionWarningVisible(true)
        } else if (timeLeft <= 0) {
          // Session expired
          logout(false)
          navigate('/login')
        }
      } catch (error) {
        console.error('Error checking session:', error)
      }
    }

    const interval = setInterval(checkSession, 30000) // Check every 30 seconds
    checkSession() // Check immediately

    return () => clearInterval(interval)
  }, [token, logout, navigate])

  // Update countdown timer
  useEffect(() => {
    if (!sessionWarningVisible || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setSessionWarningVisible(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionWarningVisible, timeRemaining])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleSessionExtend = () => {
    // In a real app, this would call an API to refresh the session
    setSessionWarningVisible(false)
    // Could implement token refresh here
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Menu items based on user permissions
  const getMenuItems = (): MenuProps['items'] => {
    const baseItems = [
      {
        key: '/chat',
        icon: <MessageOutlined />,
        label: <Link to="/chat">Chat</Link>,
      },
    ]

    const modelItems = hasPermission('manage_models') ? [
      {
        key: '/models',
        icon: <RobotOutlined />,
        label: <Link to="/models">Models</Link>,
      },
      {
        key: '/training',
        icon: <BookOutlined />,
        label: <Link to="/training">Training</Link>,
      },
    ] : []

    const adminItems = isAdmin() ? [
      {
        key: '/statistics',
        icon: <BarChartOutlined />,
        label: <Link to="/statistics">Statistics</Link>,
      },
      {
        key: '/departments',
        icon: <TeamOutlined />,
        label: <Link to="/departments">Departments</Link>,
      },
    ] : []

    const superAdminItems = isSuperAdmin() ? [
      {
        key: '/admin',
        icon: <SettingOutlined />,
        label: <Link to="/admin">Admin</Link>,
      },
    ] : []

    const helpItems = [
      {
        key: '/help',
        icon: <QuestionCircleOutlined />,
        label: <Link to="/help">Help</Link>,
      },
    ]

    return [
      ...baseItems,
      ...modelItems,
      ...adminItems,
      ...superAdminItems,
      ...helpItems,
    ]
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <div className="p-2">
          <div className="font-medium">{user?.firstName} {user?.lastName}</div>
          <div className="text-sm text-gray-500">{user?.email}</div>
          <div className="text-xs text-gray-400">
            {user?.role} • {user?.department || 'No Department'}
          </div>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'security',
      icon: <SafetyOutlined />,
      label: 'Security Settings',
      onClick: () => {
        // Navigate to security settings
        // This could be implemented as a modal or separate page
      },
    },
    {
      key: 'session',
      icon: <ClockCircleOutlined />,
      label: 'Session Info',
      onClick: () => {
        try {
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]))
            const expiryTime = new Date(payload.exp * 1000)
            Modal.info({
              title: 'Session Information',
              content: (
                <div>
                  <p><strong>Logged in as:</strong> {user?.username}</p>
                  <p><strong>Role:</strong> {user?.role}</p>
                  <p><strong>Session expires:</strong> {expiryTime.toLocaleString()}</p>
                  <p><strong>Groups:</strong> {user?.groups?.join(', ')}</p>
                </div>
              ),
            })
          }
        } catch (error) {
          console.error('Error showing session info:', error)
        }
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
      danger: true,
    },
  ]

  const getPageTitle = () => {
    const path = location.pathname
    switch (path) {
      case '/chat':
        return 'Chat'
      case '/models':
        return 'Models'
      case '/training':
        return 'Training'
      case '/admin':
        return 'Admin'
      case '/statistics':
        return 'Statistics'
      case '/departments':
        return 'Departments'
      case '/help':
        return 'Help'
      default:
        return 'MFU Learn AI'
    }
  }

  return (
    <AntLayout className="min-h-screen">
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        className="shadow-lg"
        theme="light"
        width={250}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <RobotOutlined className="text-white text-lg" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold text-gray-800">MFU Learn AI</h1>
                <p className="text-xs text-gray-500">AI Learning Platform</p>
              </div>
            )}
          </div>
        </div>
        
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          className="border-0 pt-4"
        />

        {/* User info in collapsed sidebar */}
        {collapsed && (
          <div className="absolute bottom-4 left-0 right-0 px-4">
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="topRight"
            >
              <Button
                type="text"
                className="w-full flex items-center justify-center"
              >
                <Avatar 
                  size="small" 
                  icon={<UserOutlined />}
                  className="bg-blue-500"
                />
              </Button>
            </Dropdown>
          </div>
        )}
      </Sider>
      
      <AntLayout>
        <Header className="bg-white shadow-sm border-b border-gray-200 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="text-lg"
            />
            <h1 className="text-xl font-semibold text-gray-800">
              {getPageTitle()}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <Badge count={0} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                className="text-gray-600"
              />
            </Badge>

            {/* User dropdown - only shown when sidebar is not collapsed */}
            {!collapsed && (
              <Dropdown
                menu={{ items: userMenuItems }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button type="text" className="flex items-center space-x-2 px-3">
                  <Avatar 
                    size="small" 
                    icon={<UserOutlined />}
                    className="bg-blue-500"
                  />
                  <span className="text-gray-700 font-medium">
                    {user?.firstName || user?.username}
                  </span>
                </Button>
              </Dropdown>
            )}
          </div>
        </Header>
        
        <Content className="m-6 p-6 bg-white rounded-lg shadow-sm min-h-[calc(100vh-112px)]">
          {children}
        </Content>
      </AntLayout>

      {/* Session Warning Modal */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-orange-600">
            <ClockCircleOutlined />
            <span>Session Expiring Soon</span>
          </div>
        }
        open={sessionWarningVisible}
        onCancel={() => setSessionWarningVisible(false)}
        footer={[
          <Button key="logout" onClick={handleLogout}>
            Logout Now
          </Button>,
          <Button key="extend" type="primary" onClick={handleSessionExtend}>
            Extend Session
          </Button>,
        ]}
        closable={false}
        maskClosable={false}
      >
        <div className="space-y-3">
          <p>Your session will expire in:</p>
          <div className="text-center">
            <Text strong className="text-2xl text-orange-600">
              {formatTime(timeRemaining)}
            </Text>
          </div>
          <p className="text-sm text-gray-600">
            Please save your work and extend your session or you will be automatically logged out.
          </p>
        </div>
      </Modal>
    </AntLayout>
  )
}

export default LayoutComponent 