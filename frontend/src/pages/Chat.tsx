import React, { useState, useEffect, useRef } from 'react'
import { 
  Button, 
  Input, 
  Select, 
  List, 
  Avatar, 
  Drawer,
  Upload,
  Dropdown,
  Empty,
  Spin,
  Alert,
  Badge,
  Tooltip
} from 'antd'
import { 
  SendOutlined, 
  PlusOutlined,
  UserOutlined,
  RobotOutlined,
  PaperClipOutlined,
  DeleteOutlined,
  EditOutlined,
  MenuOutlined,
  StopOutlined,
  CopyOutlined,
  WifiOutlined,
  DisconnectOutlined,
  ReloadOutlined
} from '@ant-design/icons'

import { chatApi, modelsApi, WebSocketManager } from '../utils/api'
import toast from 'react-hot-toast'
import type { MenuProps } from 'antd'

const { TextArea } = Input
const { Option } = Select

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
}

interface ChatSession {
  id: string
  title: string
  createdAt: Date
  lastMessage?: string
}

interface Model {
  _id: string
  name: string
  modelType: 'personal' | 'department' | 'official'
  createdBy: string
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [models, setModels] = useState<Model[]>([])
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [currentChatId, setCurrentChatId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string>('')
  const [editingContent, setEditingContent] = useState('')
  
  // Loading and error states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [chatsLoading, setChatsLoading] = useState(false)
  
  // WebSocket connection states
  const [wsConnected, setWsConnected] = useState(false)
  const [wsReconnecting, setWsReconnecting] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const textAreaRef = useRef<any>(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (error) {
      console.error('Error scrolling to bottom:', error)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize WebSocket Manager
  useEffect(() => {
    wsManagerRef.current = new WebSocketManager()
    
    // Setup WebSocket event handlers
    wsManagerRef.current.onOpen(() => {
      setWsConnected(true)
      setWsReconnecting(false)
      console.log('WebSocket connected')
    })

    wsManagerRef.current.onClose(() => {
      setWsConnected(false)
      setIsGenerating(false)
      console.log('WebSocket disconnected')
    })

    wsManagerRef.current.onError((error) => {
      console.error('WebSocket error:', error)
      setWsConnected(false)
      setIsGenerating(false)
      
      if (error.message?.includes('reconnect')) {
        setWsReconnecting(true)
        toast.error('Connection lost. Attempting to reconnect...')
      } else {
        toast.error('Connection error')
      }
    })

    wsManagerRef.current.onMessage((data) => {
      handleWebSocketMessage(data)
    })

    return () => {
      if (wsManagerRef.current) {
        wsManagerRef.current.close()
      }
    }
  }, [])

  // Load models and chat sessions on mount
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setLoading(true)
        setError(null)
        await Promise.all([
          loadModels(),
          loadChatSessions()
        ])
      } catch (error) {
        console.error('Error initializing chat:', error)
        setError('Failed to load chat data')
      } finally {
        setLoading(false)
      }
    }

    initializeChat()
  }, [])

  // Setup WebSocket connection when chat changes
  useEffect(() => {
    if (currentChatId && wsManagerRef.current) {
      connectWebSocket(currentChatId)
    }
  }, [currentChatId])

  const connectWebSocket = async (chatId: string) => {
    if (!wsManagerRef.current) return

    try {
      setWsReconnecting(true)
      await wsManagerRef.current.connect(chatId)
      setWsReconnecting(false)
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      setWsReconnecting(false)
      toast.error('Failed to establish real-time connection')
    }
  }

  const handleWebSocketMessage = (data: any) => {
    try {
      if (data.type === 'chunk') {
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === data.messageId) {
            return prev.map(msg => 
              msg.id === data.messageId 
                ? { ...msg, content: msg.content + data.content }
                : msg
            )
          } else {
            return [...prev, {
              id: data.messageId,
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
              model: selectedModel
            }]
          }
        })
      } else if (data.type === 'complete') {
        setIsGenerating(false)
        toast.success('Response completed')
      } else if (data.type === 'error') {
        toast.error(data.error || data.message || 'An error occurred')
        setIsGenerating(false)
      } else if (data.type === 'message_edited') {
        // Handle message edit broadcast from other clients
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, content: data.content }
            : msg
        ))
        toast.success('Message updated from another session')
      } else if (data.type === 'chat_updated') {
        // Reload chat sessions when updated from another client
        loadChatSessions()
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  const loadModels = async () => {
    try {
      setModelsLoading(true)
      // Mock data for now to prevent API errors
      const mockModels = [
        {
          _id: '1',
          name: 'General AI Assistant',
          modelType: 'official' as const,
          createdBy: 'system'
        },
        {
          _id: '2', 
          name: 'Document Helper',
          modelType: 'official' as const,
          createdBy: 'system'
        }
      ]
      
      setModels(mockModels)
      if (mockModels.length > 0 && !selectedModel) {
        setSelectedModel(mockModels[0]._id)
      }
      
      // Try to load real models from API
      try {
        const response = await modelsApi.getModels()
        if (response.data && Array.isArray(response.data)) {
          setModels(response.data)
          if (response.data.length > 0 && !selectedModel) {
            setSelectedModel(response.data[0]._id)
          }
        }
      } catch (apiError) {
        console.warn('API models not available, using mock data')
      }
    } catch (error) {
      console.error('Error loading models:', error)
      toast.error('Failed to load models')
    } finally {
      setModelsLoading(false)
    }
  }

  const loadChatSessions = async () => {
    try {
      setChatsLoading(true)
      // Mock data for now
      const mockSessions = [
        {
          id: '1',
          title: 'New Chat',
          createdAt: new Date(),
          lastMessage: 'Welcome to MFU Learn AI'
        }
      ]
      
      setChatSessions(mockSessions)
      if (mockSessions.length > 0 && !currentChatId) {
        setCurrentChatId(mockSessions[0].id)
      }
      
      // Try to load real chat sessions from API  
      try {
        const response = await chatApi.getChats()
        if (response.data && Array.isArray(response.data)) {
          setChatSessions(response.data)
          if (response.data.length > 0 && !currentChatId) {
            setCurrentChatId(response.data[0].id)
            loadChatHistory(response.data[0].id)
          }
        }
      } catch (apiError) {
        console.warn('API chats not available, using mock data')
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error)
    } finally {
      setChatsLoading(false)
    }
  }

  const loadChatHistory = async (chatId: string) => {
    try {
      const response = await chatApi.getChatHistory(chatId)
      setMessages(response.data.messages || [])
    } catch (error) {
      console.error('Error loading chat history:', error)
      // Set empty messages if API fails
      setMessages([])
    }
  }

  const createNewChat = async () => {
    try {
      // Mock implementation
      const newChat = {
        id: Date.now().toString(),
        title: 'New Chat',
        createdAt: new Date(),
        lastMessage: ''
      }
      
      setChatSessions(prev => [newChat, ...prev])
      setCurrentChatId(newChat.id)
      setMessages([])
      setSidebarOpen(false)
      
      // Try API call
      try {
        const response = await chatApi.createChat({ 
          title: 'New Chat',
          modelId: selectedModel 
        })
        const apiChat = response.data
        setChatSessions(prev => prev.map(chat => 
          chat.id === newChat.id ? apiChat : chat
        ))
        setCurrentChatId(apiChat.id)
      } catch (apiError) {
        console.warn('API create chat not available')
      }
    } catch (error) {
      console.error('Error creating new chat:', error)
      toast.error('Failed to create new chat')
    }
  }

  const deleteChat = async (chatId: string) => {
    try {
      setChatSessions(prev => prev.filter(chat => chat.id !== chatId))
      if (currentChatId === chatId) {
        const remainingChats = chatSessions.filter(chat => chat.id !== chatId)
        if (remainingChats.length > 0) {
          setCurrentChatId(remainingChats[0].id)
          loadChatHistory(remainingChats[0].id)
        } else {
          setCurrentChatId('')
          setMessages([])
        }
      }
      toast.success('Chat deleted')
      
      // Try API call
      try {
        await chatApi.deleteChat(chatId)
      } catch (apiError) {
        console.warn('API delete chat not available')
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
      toast.error('Failed to delete chat')
    }
  }

  const sendMessage = async () => {
    if (!currentMessage.trim() || !selectedModel) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const messageToSend = currentMessage
    setCurrentMessage('')
    setIsGenerating(true)

    try {
      if (wsManagerRef.current?.isConnected()) {
        const success = wsManagerRef.current.send({
          type: 'message',
          chatId: currentChatId,
          messages: [...messages, userMessage],
          modelId: selectedModel
        })

        if (!success) {
          throw new Error('Failed to send message via WebSocket')
        }
      } else {
        // Fallback: Mock response since WebSocket is not available
        setTimeout(() => {
          const mockResponse: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `This is a mock response to: "${messageToSend}". The WebSocket connection is not available.`,
            timestamp: new Date(),
            model: selectedModel
          }
          setMessages(prev => [...prev, mockResponse])
          setIsGenerating(false)
        }, 1000)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      setIsGenerating(false)
    }
  }

  const stopGeneration = () => {
    if (wsManagerRef.current?.isConnected()) {
      wsManagerRef.current.send({
        type: 'cancel',
        chatId: currentChatId
      })
    }
    setIsGenerating(false)
  }

  const startEditing = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }

  const saveEdit = async (messageId: string) => {
    try {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: editingContent }
          : msg
      ))
      setEditingMessageId('')
      setEditingContent('')
      toast.success('Message updated')
      
      // Broadcast edit to other clients via WebSocket
      if (wsManagerRef.current?.isConnected()) {
        wsManagerRef.current.send({
          type: 'message_edited',
          chatId: currentChatId,
          messageId: messageId,
          content: editingContent
        })
      }
      
      // Try API call
      try {
        await chatApi.editMessage(currentChatId, messageId, editingContent)
      } catch (apiError) {
        console.warn('API edit message not available')
      }
    } catch (error) {
      console.error('Error editing message:', error)
      toast.error('Failed to edit message')
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
      toast.success('Message deleted')
      
      // Try API call
      try {
        await chatApi.deleteMessage(currentChatId, messageId)
      } catch (apiError) {
        console.warn('API delete message not available')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Failed to delete message')
    }
  }

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Failed to copy')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const reconnectWebSocket = () => {
    if (currentChatId && wsManagerRef.current) {
      connectWebSocket(currentChatId)
    }
  }

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user'
    const isEditing = editingMessageId === message.id

    const messageActions: MenuProps['items'] = [
      {
        key: 'copy',
        label: 'Copy',
        icon: <CopyOutlined />,
        onClick: () => copyToClipboard(message.content),
      },
      {
        key: 'edit',
        label: 'Edit',
        icon: <EditOutlined />,
        onClick: () => startEditing(message.id, message.content),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: <DeleteOutlined />,
        onClick: () => deleteMessage(message.id),
        danger: true,
      },
    ]

    return (
      <div key={message.id} className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex max-w-4xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <Avatar
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            className={`${isUser ? 'bg-blue-600 ml-3' : 'bg-gray-500 mr-3'} flex-shrink-0`}
          />
          <div className={`${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'} relative group`}>
            {isEditing ? (
              <div className="space-y-2">
                <TextArea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex space-x-2">
                  <Button size="small" type="primary" onClick={() => saveEdit(message.id)}>
                    Save
                  </Button>
                  <Button size="small" onClick={() => setEditingMessageId('')}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="prose prose-sm max-w-none">
                  {message.content.split('\n').map((line, index) => (
                    <p key={index} className="mb-2 last:mb-0">{line}</p>
                  ))}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                  <Dropdown menu={{ items: messageActions }} trigger={['click']}>
                    <Button size="small" type="text" icon={<MenuOutlined />} />
                  </Dropdown>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-120px)] bg-gray-50 items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-[calc(100vh-120px)] bg-gray-50 items-center justify-center p-6">
        <div className="max-w-md w-full">
          <Alert
            message="Error Loading Chat"
            description={error}
            type="error"
            showIcon
            action={
              <Button size="small" onClick={() => window.location.reload()}>
                Retry
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-gray-50">
      {/* Chat Sidebar */}
      <Drawer
        title="Chat Sessions"
        placement="left"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={320}
      >
        <div className="space-y-4">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={createNewChat}
            block
            loading={chatsLoading}
          >
            New Chat
          </Button>
          
          <List
            dataSource={chatSessions}
            loading={chatsLoading}
            renderItem={(chat) => (
              <List.Item
                className={`cursor-pointer rounded-lg p-2 ${
                  currentChatId === chat.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  setCurrentChatId(chat.id)
                  loadChatHistory(chat.id)
                  setSidebarOpen(false)
                }}
                actions={[
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteChat(chat.id)
                    }}
                    danger
                  />
                ]}
              >
                <List.Item.Meta
                  title={<span className="text-sm font-medium">{chat.title}</span>}
                  description={
                    <span className="text-xs text-gray-500">
                      {chat.lastMessage?.substring(0, 50)}...
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Drawer>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setSidebarOpen(true)}
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                <span>{chatSessions.find(c => c.id === currentChatId)?.title || 'Chat'}</span>
                {/* WebSocket Status Indicator */}
                <Tooltip title={wsConnected ? 'Connected' : wsReconnecting ? 'Reconnecting...' : 'Disconnected'}>
                  <Badge 
                    status={wsConnected ? 'success' : wsReconnecting ? 'processing' : 'error'} 
                    dot 
                  />
                </Tooltip>
              </h2>
              <p className="text-sm text-gray-500 flex items-center space-x-2">
                <span>Model: {models.find(m => m._id === selectedModel)?.name || 'Select Model'}</span>
                {!wsConnected && !wsReconnecting && (
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<ReloadOutlined />}
                    onClick={reconnectWebSocket}
                    className="p-0 h-auto"
                  >
                    Reconnect
                  </Button>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <Tooltip title={wsConnected ? 'Real-time connection active' : 'Real-time connection inactive'}>
              {wsConnected ? (
                <WifiOutlined className="text-green-500" />
              ) : (
                <DisconnectOutlined className="text-red-500" />
              )}
            </Tooltip>
            
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              placeholder="Select Model"
              style={{ width: 200 }}
              loading={modelsLoading}
            >
              {models.map(model => (
                <Option key={model._id} value={model._id}>
                  {model.name} ({model.modelType})
                </Option>
              ))}
            </Select>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Empty
                description="Start a conversation"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {messages.map(renderMessage)}
              {isGenerating && (
                <div className="flex justify-start mb-4">
                  <div className="flex">
                    <Avatar
                      icon={<RobotOutlined />}
                      className="bg-gray-500 mr-3"
                    />
                    <div className="chat-bubble-assistant">
                      <div className="loading-dots">Thinking</div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-end space-x-3 max-w-4xl mx-auto">
            <div className="flex-1">
              <TextArea
                ref={textAreaRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                autoSize={{ minRows: 1, maxRows: 6 }}
                className="resize-none"
                disabled={isGenerating}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Upload
                beforeUpload={() => false}
                showUploadList={false}
              >
                <Button
                  icon={<PaperClipOutlined />}
                  type="text"
                  className="text-gray-500 hover:text-gray-700"
                  disabled={isGenerating}
                />
              </Upload>
              
              {isGenerating ? (
                <Button
                  type="primary"
                  danger
                  icon={<StopOutlined />}
                  onClick={stopGeneration}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || !selectedModel}
                >
                  Send
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat 