import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Tag, 
  Space,
  Popconfirm,
  Tabs,
  Statistic,
  Row,
  Col,
  Switch,
  Divider
} from 'antd'
import { 
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { adminApi } from '../utils/api'
import toast from 'react-hot-toast'

const { TabPane } = Tabs
const { Option } = Select

interface User {
  _id: string
  nameID: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  role: string
  department?: string
  groups: string[]
  created: string
  updated: string
}

interface SystemSettings {
  maxFileSize: number
  allowedFileTypes: string[]
  maxChatHistory: number
  enableGuestAccess: boolean
  maintenanceMode: boolean
}

const Admin: React.FC = () => {
  const { user, isSuperAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userStats, setUserStats] = useState<any>({})
  const [form] = Form.useForm()

  useEffect(() => {
    if (isSuperAdmin()) {
      loadUsers()
      loadSystemSettings()
      loadUserStats()
    }
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await adminApi.getUsers()
      setUsers(response.data)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadSystemSettings = async () => {
    try {
      const response = await adminApi.getSystemSettings()
      setSystemSettings(response.data)
    } catch (error) {
      console.error('Error loading system settings:', error)
    }
  }

  const loadUserStats = async () => {
    try {
      // Mock user statistics
      setUserStats({
        totalUsers: 156,
        activeUsers: 89,
        newUsersThisMonth: 12,
        totalSessions: 2341
      })
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department
    })
    setModalVisible(true)
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await adminApi.deleteUser(userId)
      setUsers(prev => prev.filter(u => u._id !== userId))
      toast.success('User deleted successfully')
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    }
  }

  const handleSubmitUser = async (values: any) => {
    try {
      if (editingUser) {
        await adminApi.updateUser(editingUser._id, values)
        setUsers(prev => prev.map(u => 
          u._id === editingUser._id ? { ...u, ...values } : u
        ))
        toast.success('User updated successfully')
      }
      setModalVisible(false)
      form.resetFields()
      setEditingUser(null)
    } catch (error) {
      console.error('Error saving user:', error)
      toast.error('Failed to save user')
    }
  }

  const handleSettingsUpdate = async (newSettings: Partial<SystemSettings>) => {
    try {
      await adminApi.updateSystemSettings(newSettings)
      setSystemSettings(prev => ({ ...prev!, ...newSettings }))
      toast.success('Settings updated successfully')
    } catch (error) {
      console.error('Error updating settings:', error)
      toast.error('Failed to update settings')
    }
  }

  const userColumns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: User) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-500">{record.nameID}</div>
        </div>
      ),
    },
    {
      title: 'Name',
      key: 'name',
      render: (record: User) => 
        `${record.firstName || ''} ${record.lastName || ''}`.trim() || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const color = role === 'SuperAdmin' ? 'red' : 
                    role === 'Admin' ? 'orange' : 
                    role === 'Staffs' ? 'blue' : 'green'
        return <Tag color={color}>{role}</Tag>
      },
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => dept || '-',
    },
    {
      title: 'Created',
      dataIndex: 'created',
      key: 'created',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              // View user details
              toast.success('User details view not implemented yet')
            }}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record._id)}
            disabled={record._id === user?.nameID}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record._id === user?.nameID}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!isSuperAdmin()) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-1">
            You don't have permission to access the admin panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-600 mt-1">
          System administration and user management
        </p>
      </div>

      <Tabs defaultActiveKey="users" className="w-full">
        <TabPane tab="Users" key="users">
          <div className="space-y-6">
            {/* User Statistics */}
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Users"
                    value={userStats.totalUsers}
                    prefix={<UserOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Active Users"
                    value={userStats.activeUsers}
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="New This Month"
                    value={userStats.newUsersThisMonth}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Sessions"
                    value={userStats.totalSessions}
                  />
                </Card>
              </Col>
            </Row>

            {/* Users Table */}
            <Card>
              <Table
                columns={userColumns}
                dataSource={users}
                rowKey="_id"
                loading={loading}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total, range) => 
                    `${range[0]}-${range[1]} of ${total} users`,
                }}
              />
            </Card>
          </div>
        </TabPane>

        <TabPane tab="System Settings" key="settings">
          <Card title="System Configuration">
            {systemSettings && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">File Upload Settings</h3>
                  <Row gutter={16}>
                    <Col span={12}>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max File Size (MB)
                          </label>
                          <Input
                            type="number"
                            value={systemSettings.maxFileSize}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value)
                              handleSettingsUpdate({ maxFileSize: newValue })
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Chat History
                          </label>
                          <Input
                            type="number"
                            value={systemSettings.maxChatHistory}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value)
                              handleSettingsUpdate({ maxChatHistory: newValue })
                            }}
                          />
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Allowed File Types
                          </label>
                          <Select
                            mode="tags"
                            style={{ width: '100%' }}
                            value={systemSettings.allowedFileTypes}
                            onChange={(value) => handleSettingsUpdate({ allowedFileTypes: value })}
                            placeholder="Add file extensions"
                          >
                            <Option value="pdf">PDF</Option>
                            <Option value="doc">DOC</Option>
                            <Option value="docx">DOCX</Option>
                            <Option value="txt">TXT</Option>
                            <Option value="md">MD</Option>
                          </Select>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>

                <Divider />

                <div>
                  <h3 className="text-lg font-semibold mb-4">Access Control</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Enable Guest Access</div>
                        <div className="text-sm text-gray-500">
                          Allow users to login as guests without SAML authentication
                        </div>
                      </div>
                      <Switch
                        checked={systemSettings.enableGuestAccess}
                        onChange={(checked) => handleSettingsUpdate({ enableGuestAccess: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Maintenance Mode</div>
                        <div className="text-sm text-gray-500">
                          Temporarily disable access to the system
                        </div>
                      </div>
                      <Switch
                        checked={systemSettings.maintenanceMode}
                        onChange={(checked) => handleSettingsUpdate({ maintenanceMode: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* Edit User Modal */}
      <Modal
        title={editingUser ? 'Edit User' : 'Create New User'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingUser(null)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitUser}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="Username"
                rules={[{ required: true, message: 'Please enter username' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter valid email' }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="First Name"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select>
                  <Option value="Students">Students</Option>
                  <Option value="Staffs">Staffs</Option>
                  <Option value="Admin">Admin</Option>
                  <Option value="SuperAdmin">SuperAdmin</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="department"
                label="Department"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setModalVisible(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default Admin 