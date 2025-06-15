import React from 'react'
import { Card, Collapse, Typography } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

const { Panel } = Collapse
const { Title, Paragraph } = Typography

const Help: React.FC = () => {
  const faqData = [
    {
      key: '1',
      label: 'How do I create a new model?',
      children: (
        <Paragraph>
          To create a new model, go to the Models page and click the "Create Model" button. 
          Fill in the model name, select the model type (Personal, Department, or Official), 
          and if it's a department model, select the appropriate department.
        </Paragraph>
      ),
    },
    {
      key: '2',
      label: 'How do I upload training documents?',
      children: (
        <Paragraph>
          Navigate to the Training page, create or select a collection, then use the 
          "Upload Document" button to add your training materials. Supported formats 
          include PDF, DOC, DOCX, TXT, and MD files.
        </Paragraph>
      ),
    },
    {
      key: '3',
      label: 'What are the different model types?',
      children: (
        <div>
          <Paragraph>
            <strong>Personal:</strong> Models created by individual users for their own use.
          </Paragraph>
          <Paragraph>
            <strong>Department:</strong> Models shared within a specific department.
          </Paragraph>
          <Paragraph>
            <strong>Official:</strong> System-wide models available to all users.
          </Paragraph>
        </div>
      ),
    },
    {
      key: '4',
      label: 'How do I start a chat session?',
      children: (
        <Paragraph>
          Go to the Chat page, select a model from the dropdown, and start typing your 
          message. You can create new chat sessions using the "New Chat" button in the sidebar.
        </Paragraph>
      ),
    },
    {
      key: '5',
      label: 'Can I edit or delete my messages?',
      children: (
        <Paragraph>
          Yes, you can edit or delete your messages by hovering over them and clicking 
          the menu button that appears. This will show options to copy, edit, or delete the message.
        </Paragraph>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
        <p className="text-gray-600 mt-1">
          Find answers to common questions and learn how to use MFU Learn AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Frequently Asked Questions">
            <Collapse
              items={faqData}
              defaultActiveKey={['1']}
              expandIconPosition="start"
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="text-center">
              <QuestionCircleOutlined className="text-4xl text-blue-600 mb-4" />
              <Title level={4}>Need More Help?</Title>
              <Paragraph className="text-gray-600">
                If you can't find the answer you're looking for, please contact our support team.
              </Paragraph>
              <div className="space-y-2 text-sm text-gray-500">
                <div>Email: support@mfu.ac.th</div>
                <div>Phone: +66 (0) 53 916 000</div>
                <div>Hours: Mon-Fri 8:00-17:00</div>
              </div>
            </div>
          </Card>

          <Card title="Quick Tips">
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                <span>Use specific and clear prompts for better AI responses</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                <span>Upload high-quality documents for training</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                <span>Organize your collections by topic or department</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                <span>Regularly review and update your training data</span>
              </div>
            </div>
          </Card>

          <Card title="System Status">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">API Status</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Chat Service</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">File Upload</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Online</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Help 