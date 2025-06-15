import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Select,  
  Space,
  Progress,
  Tag
} from 'antd'
import { 
  BarChartOutlined,
  UserOutlined,
  MessageOutlined,
  FileOutlined,
  TrophyOutlined,
  RiseOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const { Option } = Select

interface UserStats {
  totalChats: number
  totalMessages: number
  totalDocuments: number
  averageSessionDuration: number
  modelUsage: { [key: string]: number }
}

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalSessions: number
  totalUploadedFiles: number
  popularModels: Array<{ name: string; usage: number }>
  dailyUsage: Array<{ date: string; users: number; sessions: number }>
}

const Statistics: React.FC = () => {
  const { isAdmin } = useAuth()
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    loadUserStats()
    if (isAdmin()) {
      loadSystemStats()
    }
  }, [timeRange])

  const loadUserStats = async () => {
    setLoading(true)
    try {
      // Mock user statistics
      setUserStats({
        totalChats: 45,
        totalMessages: 342,
        totalDocuments: 23,
        averageSessionDuration: 18.5,
        modelUsage: {
          'General AI': 156,
          'Document Assistant': 98,
          'Code Helper': 88
        }
      })
    } catch (error) {
      console.error('Error loading user stats:', error)
      toast.error('Failed to load user statistics')
    } finally {
      setLoading(false)
    }
  }

  const loadSystemStats = async () => {
    try {
      // Mock system statistics
      setSystemStats({
        totalUsers: 1247,
        activeUsers: 389,
        totalSessions: 5678,
        totalUploadedFiles: 2341,
        popularModels: [
          { name: 'General AI', usage: 2341 },
          { name: 'Document Assistant', usage: 1876 },
          { name: 'Code Helper', usage: 1234 },
          { name: 'Research Assistant', usage: 987 }
        ],
        dailyUsage: [
          { date: '2024-01-01', users: 45, sessions: 123 },
          { date: '2024-01-02', users: 52, sessions: 145 },
          { date: '2024-01-03', users: 48, sessions: 134 },
          { date: '2024-01-04', users: 61, sessions: 167 },
          { date: '2024-01-05', users: 58, sessions: 156 },
          { date: '2024-01-06', users: 67, sessions: 189 },
          { date: '2024-01-07', users: 73, sessions: 198 }
        ]
      })
    } catch (error) {
      console.error('Error loading system stats:', error)
    }
  }

  const modelUsageColumns = [
    {
      title: 'Model Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <div className="flex items-center space-x-2">
          <BarChartOutlined />
          <span>{text}</span>
        </div>
      ),
    },
    {
      title: 'Usage Count',
      dataIndex: 'usage',
      key: 'usage',
      render: (usage: number) => (
        <Tag color="blue">{usage.toLocaleString()}</Tag>
      ),
    },
    {
      title: 'Popularity',
      key: 'popularity',
      render: (record: any) => {
        const maxUsage = systemStats?.popularModels[0]?.usage || 1
        const percentage = (record.usage / maxUsage) * 100
        return <Progress percent={Math.round(percentage)} size="small" />
      },
    },
  ]

  const dailyUsageColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Active Users',
      dataIndex: 'users',
      key: 'users',
      render: (users: number) => (
        <div className="flex items-center space-x-2">
          <UserOutlined />
          <span>{users}</span>
        </div>
      ),
    },
    {
      title: 'Sessions',
      dataIndex: 'sessions',
      key: 'sessions',
      render: (sessions: number) => (
        <div className="flex items-center space-x-2">
          <MessageOutlined />
          <span>{sessions}</span>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
          <p className="text-gray-600 mt-1">
            Usage analytics and system statistics
          </p>
        </div>
        <Space>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 120 }}
          >
            <Option value="1d">Last 24h</Option>
            <Option value="7d">Last 7 days</Option>
            <Option value="30d">Last 30 days</Option>
            <Option value="90d">Last 90 days</Option>
          </Select>
        </Space>
      </div>

      {/* Personal Statistics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Personal Statistics</h2>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Chats"
                value={userStats?.totalChats}
                prefix={<MessageOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Messages Sent"
                value={userStats?.totalMessages}
                prefix={<MessageOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Documents Uploaded"
                value={userStats?.totalDocuments}
                prefix={<FileOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Avg. Session (min)"
                value={userStats?.averageSessionDuration}
                prefix={<ClockCircleOutlined />}
                precision={1}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Personal Model Usage */}
      <Card title="Your Model Usage">
        {userStats?.modelUsage && (
          <Row gutter={16}>
            {Object.entries(userStats.modelUsage).map(([model, usage]) => (
              <Col span={8} key={model}>
                <Card size="small">
                  <Statistic
                    title={model}
                    value={usage}
                    prefix={<TrophyOutlined />}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* System Statistics (Admin only) */}
      {isAdmin() && systemStats && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">System Statistics</h2>
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Users"
                    value={systemStats.totalUsers}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Active Users"
                    value={systemStats.activeUsers}
                    prefix={<RiseOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Sessions"
                    value={systemStats.totalSessions}
                    prefix={<MessageOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Uploaded Files"
                    value={systemStats.totalUploadedFiles}
                    prefix={<FileOutlined />}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Card title="Popular Models">
                <Table
                  columns={modelUsageColumns}
                  dataSource={systemStats.popularModels}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Daily Usage">
                <Table
                  columns={dailyUsageColumns}
                  dataSource={systemStats.dailyUsage}
                  rowKey="date"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Usage Trends */}
      <Card title="Usage Trends">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Chat Activity</span>
            <Progress 
              percent={75} 
              size="small" 
              status="active"
              format={() => "↗ 15% vs last week"}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Document Uploads</span>
            <Progress 
              percent={60} 
              size="small" 
              status="active"
              format={() => "↗ 8% vs last week"}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Model Training</span>
            <Progress 
              percent={45} 
              size="small" 
              format={() => "↘ 3% vs last week"}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

export default Statistics 