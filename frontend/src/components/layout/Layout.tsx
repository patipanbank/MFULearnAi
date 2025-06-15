import React, { useState } from 'react'
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button, Badge } from 'antd'
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
  DatabaseOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = AntLayout

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()

  const menuItems: MenuProps['items'] = [
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: 'Chat',
      onClick: () => navigate('/chat'),
    },
    {
      key: '/models',
      icon: <RobotOutlined />,
      label: 'Models',
      onClick: () => navigate('/models'),
    },
    {
      key: '/training',
      icon: <BookOutlined />,
      label: 'Training',
      onClick: () => navigate('/training'),
    },
    ...(isAdmin() ? [
      {
        key: 'admin-section',
        type: 'divider' as const,
      },
      {
        key: '/admin',
        icon: <SettingOutlined />,
        label: 'Admin',
        onClick: () => navigate('/admin'),
      },
      {
        key: '/departments',
        icon: <TeamOutlined />,
        label: 'Departments',
        onClick: () => navigate('/departments'),
      },
    ] : []),
    {
      key: 'other-section',
      type: 'divider' as const,
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: 'Statistics',
      onClick: () => navigate('/statistics'),
    },
    {
      key: '/help',
      icon: <QuestionCircleOutlined />,
      label: 'Help',
      onClick: () => navigate('/help'),
    },
  ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <div className="px-3 py-2">
          <div className="font-medium text-gray-900">
            {user?.firstName || user?.username}
          </div>
          <div className="text-sm text-gray-500">
            {user?.email}
          </div>
          <div className="text-xs text-gray-400">
            {user?.department}
          </div>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: logout,
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
        width={280}
      >
        <div className="flex items-center justify-center h-16 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <DatabaseOutlined className="text-2xl text-blue-600" />
            {!collapsed && (
              <span className="text-lg font-bold text-gray-800">
                MFU Learn AI
              </span>
            )}
          </div>
        </div>
        
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="border-r-0 pt-4"
        />
      </Sider>
      
      <AntLayout>
        <Header className="flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center space-x-4">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-600 hover:text-gray-900"
            />
            <h1 className="text-xl font-semibold text-gray-800">
              {getPageTitle()}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge dot={false}>
              <Avatar 
                icon={<UserOutlined />} 
                className="bg-blue-600"
              />
            </Badge>
            
            <Dropdown 
              menu={{ items: userMenuItems }} 
              placement="bottomRight"
              trigger={['click']}
            >
              <Button type="text" className="text-gray-700 hover:text-gray-900">
                <div className="flex items-center space-x-2">
                  <span className="hidden sm:inline">
                    {user?.firstName || user?.username}
                  </span>
                  <Avatar 
                    size="small" 
                    icon={<UserOutlined />}
                    className="bg-gray-400"
                  />
                </div>
              </Button>
            </Dropdown>
          </div>
        </Header>
        
        <Content className="m-6 p-6 bg-white rounded-lg shadow-sm min-h-[calc(100vh-120px)]">
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout 