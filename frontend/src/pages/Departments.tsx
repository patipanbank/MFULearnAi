import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Tag, 
  Space,
  Popconfirm,
  Descriptions,
  Avatar,
  List,
  Divider
} from 'antd'
import { 
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { departmentsApi } from '../utils/api'
import toast from 'react-hot-toast'

const { TextArea } = Input

interface Department {
  _id: string
  name: string
  description?: string
  headOfDepartment?: string
  members: Array<{
    userId: string
    username: string
    role: string
  }>
  createdAt: string
  updatedAt: string
}

const Departments: React.FC = () => {
  const { isAdmin } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [viewingDepartment, setViewingDepartment] = useState<Department | null>(null)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    setLoading(true)
    try {
      // Mock departments data
      setDepartments([
        {
          _id: '1',
          name: 'Computer Engineering',
          description: 'Department of Computer Engineering focusing on software development and IT solutions',
          headOfDepartment: 'Dr. John Smith',
          members: [
            { userId: '1', username: 'john.smith', role: 'Head' },
            { userId: '2', username: 'jane.doe', role: 'Staff' },
            { userId: '3', username: 'bob.wilson', role: 'Staff' }
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z'
        },
        {
          _id: '2',
          name: 'Business Administration',
          description: 'Department of Business Administration managing business processes and strategy',
          headOfDepartment: 'Prof. Sarah Johnson',
          members: [
            { userId: '4', username: 'sarah.johnson', role: 'Head' },
            { userId: '5', username: 'mike.brown', role: 'Staff' },
            { userId: '6', username: 'lisa.davis', role: 'Staff' },
            { userId: '7', username: 'tom.clark', role: 'Staff' }
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-10T00:00:00Z'
        },
        {
          _id: '3',
          name: 'Marketing',
          description: 'Marketing department responsible for brand promotion and market research',
          headOfDepartment: 'Ms. Emily White',
          members: [
            { userId: '8', username: 'emily.white', role: 'Head' },
            { userId: '9', username: 'alex.green', role: 'Staff' }
          ],
          createdAt: '2024-01-05T00:00:00Z',
          updatedAt: '2024-01-20T00:00:00Z'
        }
      ])
    } catch (error) {
      console.error('Error loading departments:', error)
      toast.error('Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDepartment = () => {
    setEditingDepartment(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department)
    form.setFieldsValue({
      name: department.name,
      description: department.description,
      headOfDepartment: department.headOfDepartment
    })
    setModalVisible(true)
  }

  const handleViewDepartment = (department: Department) => {
    setViewingDepartment(department)
    setViewModalVisible(true)
  }

  const handleDeleteDepartment = async (departmentId: string) => {
    try {
      await departmentsApi.deleteDepartment(departmentId)
      setDepartments(prev => prev.filter(d => d._id !== departmentId))
      toast.success('Department deleted successfully')
    } catch (error) {
      console.error('Error deleting department:', error)
      toast.error('Failed to delete department')
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingDepartment) {
        await departmentsApi.updateDepartment(editingDepartment._id, values)
        setDepartments(prev => prev.map(d => 
          d._id === editingDepartment._id ? { ...d, ...values } : d
        ))
        toast.success('Department updated successfully')
      } else {
        const response = await departmentsApi.createDepartment(values)
        setDepartments(prev => [response.data, ...prev])
        toast.success('Department created successfully')
      }
      setModalVisible(false)
      form.resetFields()
      setEditingDepartment(null)
    } catch (error) {
      console.error('Error saving department:', error)
      toast.error('Failed to save department')
    }
  }

  const columns = [
    {
      title: 'Department Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Department) => (
        <div className="flex items-center space-x-3">
          <Avatar icon={<TeamOutlined />} className="bg-blue-500" />
          <div>
            <div className="font-medium text-gray-900">{text}</div>
            <div className="text-sm text-gray-500">
              {record.members.length} members
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Head of Department',
      dataIndex: 'headOfDepartment',
      key: 'headOfDepartment',
      render: (head: string) => head || '-',
    },
    {
      title: 'Members',
      key: 'members',
      render: (record: Department) => (
        <Tag color="blue">{record.members.length} members</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Department) => (
        <Space size="small">
          <Button
            type="text"
            icon={<UserOutlined />}
            onClick={() => handleViewDepartment(record)}
            title="View Details"
          />
          {isAdmin() && (
            <>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEditDepartment(record)}
                title="Edit Department"
              />
              <Popconfirm
                title="Are you sure you want to delete this department?"
                onConfirm={() => handleDeleteDepartment(record._id)}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  title="Delete Department"
                />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600 mt-1">
            Manage organizational departments and their members
          </p>
        </div>
        {isAdmin() && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateDepartment}
          >
            Create Department
          </Button>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={departments}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} departments`,
          }}
        />
      </Card>

      {/* Create/Edit Department Modal */}
      <Modal
        title={editingDepartment ? 'Edit Department' : 'Create Department'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingDepartment(null)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Department Name"
            rules={[{ required: true, message: 'Please enter department name' }]}
          >
            <Input placeholder="Enter department name" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={4}
              placeholder="Enter department description"
            />
          </Form.Item>

          <Form.Item
            name="headOfDepartment"
            label="Head of Department"
          >
            <Input placeholder="Enter head of department name" />
          </Form.Item>

          <Divider />

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setModalVisible(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {editingDepartment ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* View Department Modal */}
      <Modal
        title="Department Details"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {viewingDepartment && (
          <div className="space-y-6">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Department Name">
                {viewingDepartment.name}
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {viewingDepartment.description || 'No description provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Head of Department">
                {viewingDepartment.headOfDepartment || 'Not assigned'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(viewingDepartment.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {new Date(viewingDepartment.updatedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <h3 className="text-lg font-semibold mb-4">Department Members</h3>
              <List
                dataSource={viewingDepartment.members}
                renderItem={(member) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={member.username}
                      description={
                        <Tag color={member.role === 'Head' ? 'red' : 'blue'}>
                          {member.role}
                        </Tag>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Departments 