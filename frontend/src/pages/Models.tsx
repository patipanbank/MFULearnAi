import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Table, 
  Tag, 
  Space,
  Popconfirm,
  Badge,
  Divider,
  Empty
} from 'antd'
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined,
  RobotOutlined,
  UserOutlined,
  TeamOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { modelsApi, departmentsApi } from '../utils/api'
import toast from 'react-hot-toast'

const { Option } = Select
const { TextArea } = Input

interface Model {
  _id: string
  name: string
  modelType: 'personal' | 'department' | 'official'
  createdBy: string
  department?: string
  collections: string[]
  createdAt: string
  updatedAt: string
}

interface Department {
  _id: string
  name: string
}

const Models: React.FC = () => {
  const { user, isAdmin } = useAuth()
  const [models, setModels] = useState<Model[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadModels()
    loadDepartments()
  }, [])

  const loadModels = async () => {
    setLoading(true)
    try {
      const response = await modelsApi.getModels()
      setModels(response.data)
    } catch (error) {
      console.error('Error loading models:', error)
      toast.error('Failed to load models')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const response = await departmentsApi.getDepartments()
      setDepartments(response.data)
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }

  const handleCreateModel = () => {
    setEditingModel(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditModel = (model: Model) => {
    setEditingModel(model)
    form.setFieldsValue({
      name: model.name,
      modelType: model.modelType,
      department: model.department
    })
    setModalVisible(true)
  }

  const handleDeleteModel = async (modelId: string) => {
    try {
      await modelsApi.deleteModel(modelId)
      setModels(prev => prev.filter(model => model._id !== modelId))
      toast.success('Model deleted successfully')
    } catch (error) {
      console.error('Error deleting model:', error)
      toast.error('Failed to delete model')
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingModel) {
        // Update existing model (if needed)
        // Note: The current API doesn't have update endpoint, only collections update
        toast.success('Model update not yet implemented')
      } else {
        // Create new model
        const response = await modelsApi.createModel(values)
        setModels(prev => [response.data, ...prev])
        toast.success('Model created successfully')
      }
      setModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('Error saving model:', error)
      toast.error('Failed to save model')
    }
  }

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'personal':
        return <UserOutlined />
      case 'department':
        return <TeamOutlined />
      case 'official':
        return <GlobalOutlined />
      default:
        return <RobotOutlined />
    }
  }

  const getModelTypeColor = (type: string) => {
    switch (type) {
      case 'personal':
        return 'blue'
      case 'department':
        return 'green'
      case 'official':
        return 'gold'
      default:
        return 'default'
    }
  }

  const canManageModel = (model: Model) => {
    if (isAdmin()) return true
    if (model.modelType === 'personal' && model.createdBy === user?.nameID) return true
    return false
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Model) => (
        <div className="flex items-center space-x-2">
          {getModelTypeIcon(record.modelType)}
          <span className="font-medium">{text}</span>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'modelType',
      key: 'modelType',
      render: (type: string) => (
        <Tag color={getModelTypeColor(type)} className="capitalize">
          {type}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => dept || '-',
    },
    {
      title: 'Collections',
      dataIndex: 'collections',
      key: 'collections',
      render: (collections: string[]) => (
        <Badge count={collections?.length || 0} color="blue" />
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Model) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditModel(record)}
            disabled={!canManageModel(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this model?"
            onConfirm={() => handleDeleteModel(record._id)}
            disabled={!canManageModel(record)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={!canManageModel(record)}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Models</h1>
          <p className="text-gray-600 mt-1">
            Manage your AI models and their training collections
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateModel}
        >
          Create Model
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={models}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} models`,
          }}
          locale={{
            emptyText: (
              <Empty
                description="No models found"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      <Modal
        title={editingModel ? 'Edit Model' : 'Create New Model'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="space-y-4"
        >
          <Form.Item
            name="name"
            label="Model Name"
            rules={[
              { required: true, message: 'Please enter model name' },
              { min: 3, message: 'Model name must be at least 3 characters' }
            ]}
          >
            <Input 
              placeholder="Enter model name"
              prefix={<RobotOutlined className="text-gray-400" />}
            />
          </Form.Item>

          <Form.Item
            name="modelType"
            label="Model Type"
            rules={[{ required: true, message: 'Please select model type' }]}
          >
            <Select placeholder="Select model type">
              <Option value="personal">
                <div className="flex items-center space-x-2">
                  <UserOutlined />
                  <span>Personal</span>
                </div>
              </Option>
              {isAdmin() && (
                <>
                  <Option value="department">
                    <div className="flex items-center space-x-2">
                      <TeamOutlined />
                      <span>Department</span>
                    </div>
                  </Option>
                  <Option value="official">
                    <div className="flex items-center space-x-2">
                      <GlobalOutlined />
                      <span>Official</span>
                    </div>
                  </Option>
                </>
              )}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.modelType !== currentValues.modelType
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('modelType') === 'department' ? (
                <Form.Item
                  name="department"
                  label="Department"
                  rules={[{ required: true, message: 'Please select department' }]}
                >
                  <Select placeholder="Select department">
                    {departments.map(dept => (
                      <Option key={dept._id} value={dept.name}>
                        {dept.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Divider />

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setModalVisible(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              {editingModel ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default Models 