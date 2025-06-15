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
  Empty
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
  CopyOutlined
} from '@ant-design/icons'

import { chatApi, modelsApi, createWebSocketConnection } from '../utils/api'
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const textAreaRef = useRef<any>(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load models and chat sessions on mount
  useEffect(() => {
    loadModels()
    loadChatSessions()
  }, [])

  // Setup WebSocket connection
  useEffect(() => {
    if (currentChatId) {
      setupWebSocket(currentChatId)
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [currentChatId])

  const loadModels = async () => {
    try {
      const response = await modelsApi.getModels()
      setModels(response.data)
      if (response.data.length > 0 && !selectedModel) {
        setSelectedModel(response.data[0]._id)
      }
    } catch (error) {
      console.error('Error loading models:', error)
      toast.error('Failed to load models')
    }
  }

  const loadChatSessions = async () => {
    try {
      const response = await chatApi.getChats()
      setChatSessions(response.data)
      if (response.data.length > 0 && !currentChatId) {
        setCurrentChatId(response.data[0].id)
        loadChatHistory(response.data[0].id)
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error)
    }
  }

  const loadChatHistory = async (chatId: string) => {
    try {
      const response = await chatApi.getChatHistory(chatId)
      setMessages(response.data.messages || [])
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const setupWebSocket = (chatId: string) => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    try {
      wsRef.current = createWebSocketConnection(chatId)
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected')
      }

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
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
        } else if (data.type === 'error') {
          toast.error(data.message || 'An error occurred')
          setIsGenerating(false)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        toast.error('Connection error')
        setIsGenerating(false)
      }

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected')
        setIsGenerating(false)
      }
    } catch (error) {
      console.error('Error setting up WebSocket:', error)
      toast.error('Failed to establish connection')
    }
  }

  const createNewChat = async () => {
    try {
      const response = await chatApi.createChat({ 
        title: 'New Chat',
        modelId: selectedModel 
      })
      const newChat = response.data
      setChatSessions(prev => [newChat, ...prev])
      setCurrentChatId(newChat.id)
      setMessages([])
      setSidebarOpen(false)
    } catch (error) {
      console.error('Error creating new chat:', error)
      toast.error('Failed to create new chat')
    }
  }

  const deleteChat = async (chatId: string) => {
    try {
      await chatApi.deleteChat(chatId)
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
    setCurrentMessage('')
    setIsGenerating(true)

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        chatId: currentChatId,
        message: currentMessage,
        modelId: selectedModel
      }))
    } else {
      // Fallback to HTTP if WebSocket is not available
      try {
        const response = await chatApi.sendMessage(currentChatId, currentMessage, selectedModel)
        setMessages(prev => [...prev, {
          id: response.data.messageId,
          role: 'assistant',
          content: response.data.content,
          timestamp: new Date(),
          model: selectedModel
        }])
      } catch (error) {
        console.error('Error sending message:', error)
        toast.error('Failed to send message')
      } finally {
        setIsGenerating(false)
      }
    }
  }

  const stopGeneration = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cancel',
        chatId: currentChatId
      }))
    }
    setIsGenerating(false)
  }

  const startEditing = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }

  const saveEdit = async (messageId: string) => {
    try {
      await chatApi.editMessage(currentChatId, messageId, editingContent)
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: editingContent }
          : msg
      ))
      setEditingMessageId('')
      setEditingContent('')
      toast.success('Message updated')
    } catch (error) {
      console.error('Error editing message:', error)
      toast.error('Failed to edit message')
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      await chatApi.deleteMessage(currentChatId, messageId)
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
      toast.success('Message deleted')
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Failed to delete message')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
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
          >
            New Chat
          </Button>
          
          <List
            dataSource={chatSessions}
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
              <h2 className="text-lg font-semibold text-gray-800">
                {chatSessions.find(c => c.id === currentChatId)?.title || 'Chat'}
              </h2>
              <p className="text-sm text-gray-500">
                Model: {models.find(m => m._id === selectedModel)?.name || 'Select Model'}
              </p>
            </div>
          </div>
          
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            placeholder="Select Model"
            style={{ width: 200 }}
          >
            {models.map(model => (
              <Option key={model._id} value={model._id}>
                {model.name} ({model.modelType})
              </Option>
            ))}
          </Select>
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