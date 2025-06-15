import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Upload, 
  Table, 
  Space,
  Popconfirm,
  Tag,
  Divider,
  Empty,
  Tabs
} from 'antd'
import { 
  PlusOutlined, 
  DeleteOutlined,
  UploadOutlined,
  FileOutlined,
  FolderOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { trainingApi } from '../utils/api'
import toast from 'react-hot-toast'

const { TextArea } = Input
const { TabPane } = Tabs

interface Collection {
  _id: string
  name: string
  description?: string
  documentCount: number
  createdAt: string
  createdBy: string
}

interface Document {
  _id: string
  filename: string
  originalName: string
  size: number
  uploadedAt: string
  processed: boolean
}

interface TrainingHistory {
  _id: string
  action: string
  documentName: string
  collectionName: string
  timestamp: string
  username: string
}

const Training: React.FC = () => {
  useAuth()
  const [collections, setCollections] = useState<Collection[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistory[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [collectionModalVisible, setCollectionModalVisible] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadCollections()
    loadTrainingHistory()
  }, [])

  useEffect(() => {
    if (selectedCollection) {
      loadDocuments(selectedCollection)
    }
  }, [selectedCollection])

  const loadCollections = async () => {
    setLoading(true)
    try {
      const response = await trainingApi.getCollections()
      setCollections(response.data)
      if (response.data.length > 0 && !selectedCollection) {
        setSelectedCollection(response.data[0]._id)
      }
    } catch (error) {
      console.error('Error loading collections:', error)
      toast.error('Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  const loadDocuments = async (collectionId: string) => {
    try {
      const response = await trainingApi.getDocuments(collectionId)
      setDocuments(response.data)
    } catch (error) {
      console.error('Error loading documents:', error)
      toast.error('Failed to load documents')
    }
  }

  const loadTrainingHistory = async () => {
    try {
      const response = await trainingApi.getTrainingHistory()
      setTrainingHistory(response.data)
    } catch (error) {
      console.error('Error loading training history:', error)
    }
  }

  const handleCreateCollection = async (values: any) => {
    try {
      const response = await trainingApi.createCollection(values)
      setCollections(prev => [response.data, ...prev])
      setCollectionModalVisible(false)
      form.resetFields()
      toast.success('Collection created successfully')
    } catch (error) {
      console.error('Error creating collection:', error)
      toast.error('Failed to create collection')
    }
  }

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await trainingApi.deleteCollection(collectionId)
      setCollections(prev => prev.filter(col => col._id !== collectionId))
      if (selectedCollection === collectionId) {
        const remaining = collections.filter(col => col._id !== collectionId)
        setSelectedCollection(remaining.length > 0 ? remaining[0]._id : '')
      }
      toast.success('Collection deleted successfully')
    } catch (error) {
      console.error('Error deleting collection:', error)
      toast.error('Failed to delete collection')
    }
  }

  const handleUploadDocument = async (file: File) => {
    if (!selectedCollection) {
      toast.error('Please select a collection first')
      return false
    }

    setUploading(true)
    try {
      await trainingApi.uploadDocument(selectedCollection, file)
      await loadDocuments(selectedCollection)
      await loadTrainingHistory()
      toast.success('Document uploaded successfully')
    } catch (error) {
      console.error('Error uploading document:', error)
      toast.error('Failed to upload document')
    } finally {
      setUploading(false)
    }
    return false // Prevent default upload behavior
  }

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await trainingApi.deleteDocument(selectedCollection, documentId)
      setDocuments(prev => prev.filter(doc => doc._id !== documentId))
      await loadTrainingHistory()
      toast.success('Document deleted successfully')
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  const collectionColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <div className="flex items-center space-x-2">
          <FolderOutlined />
          <span className="font-medium">{text}</span>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: 'Documents',
      dataIndex: 'documentCount',
      key: 'documentCount',
      render: (count: number) => (
        <Tag color="blue">{count} documents</Tag>
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
      render: (_: any, record: Collection) => (
        <Space size="small">
          <Button
            type="text"
            onClick={() => setSelectedCollection(record._id)}
            className={selectedCollection === record._id ? 'text-blue-600' : ''}
          >
            {selectedCollection === record._id ? 'Selected' : 'Select'}
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this collection?"
            onConfirm={() => handleDeleteCollection(record._id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const documentColumns = [
    {
      title: 'File Name',
      dataIndex: 'originalName',
      key: 'originalName',
      render: (text: string) => (
        <div className="flex items-center space-x-2">
          <FileOutlined />
          <span>{text}</span>
        </div>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
    },
    {
      title: 'Status',
      dataIndex: 'processed',
      key: 'processed',
      render: (processed: boolean) => (
        <Tag color={processed ? 'green' : 'orange'}>
          {processed ? 'Processed' : 'Processing'}
        </Tag>
      ),
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Document) => (
        <Popconfirm
          title="Are you sure you want to delete this document?"
          onConfirm={() => handleDeleteDocument(record._id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const historyColumns = [
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (
        <Tag color="blue" className="capitalize">
          {action.replace('_', ' ')}
        </Tag>
      ),
    },
    {
      title: 'Document',
      dataIndex: 'documentName',
      key: 'documentName',
    },
    {
      title: 'Collection',
      dataIndex: 'collectionName',
      key: 'collectionName',
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training</h1>
          <p className="text-gray-600 mt-1">
            Manage your training collections and documents
          </p>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCollectionModalVisible(true)}
          >
            New Collection
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setUploadModalVisible(true)}
            disabled={!selectedCollection}
          >
            Upload Document
          </Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="collections" className="w-full">
        <TabPane tab="Collections" key="collections">
          <Card>
            <Table
              columns={collectionColumns}
              dataSource={collections}
              rowKey="_id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: (
                  <Empty
                    description="No collections found"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setCollectionModalVisible(true)}
                    >
                      Create Collection
                    </Button>
                  </Empty>
                ),
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Documents" key="documents">
          <Card>
            {selectedCollection ? (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Collection: {collections.find(c => c._id === selectedCollection)?.name}
                  </h3>
                  <Upload
                    beforeUpload={handleUploadDocument}
                    showUploadList={false}
                    accept=".pdf,.doc,.docx,.txt,.md"
                  >
                    <Button icon={<UploadOutlined />} loading={uploading}>
                      Upload Document
                    </Button>
                  </Upload>
                </div>
                <Table
                  columns={documentColumns}
                  dataSource={documents}
                  rowKey="_id"
                  pagination={{ pageSize: 10 }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No documents in this collection"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                />
              </div>
            ) : (
              <Empty description="Please select a collection to view documents" />
            )}
          </Card>
        </TabPane>

        <TabPane tab="History" key="history">
          <Card>
            <Table
              columns={historyColumns}
              dataSource={trainingHistory}
              rowKey="_id"
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: (
                  <Empty
                    description="No training history found"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Collection Modal */}
      <Modal
        title="Create New Collection"
        open={collectionModalVisible}
        onCancel={() => setCollectionModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateCollection}
        >
          <Form.Item
            name="name"
            label="Collection Name"
            rules={[
              { required: true, message: 'Please enter collection name' },
              { min: 3, message: 'Collection name must be at least 3 characters' }
            ]}
          >
            <Input placeholder="Enter collection name" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={4}
              placeholder="Enter collection description (optional)"
            />
          </Form.Item>

          <Divider />

          <div className="flex justify-end space-x-3">
            <Button onClick={() => setCollectionModalVisible(false)}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Upload Modal */}
      <Modal
        title="Upload Document"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Upload documents to the selected collection. Supported formats: PDF, DOC, DOCX, TXT, MD
          </p>
          
          <Upload.Dragger
            beforeUpload={handleUploadDocument}
            showUploadList={false}
            accept=".pdf,.doc,.docx,.txt,.md"
            className="w-full"
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Click or drag file to this area to upload</p>
            <p className="ant-upload-hint">
              Support for single file upload. File size limit: 10MB
            </p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  )
}

export default Training 