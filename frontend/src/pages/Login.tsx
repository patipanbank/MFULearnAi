import React, { useState } from 'react'
import { Button, Card, Form, Input, Divider, Alert } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { authApi } from '../utils/api'
import toast from 'react-hot-toast'

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')

  const handleSamlLogin = async () => {
    setLoading(true)
    try {
      // Redirect to SAML login endpoint
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login/saml`
    } catch (error) {
      console.error('SAML login error:', error)
      toast.error('Failed to initiate SAML login')
      setLoading(false)
    }
  }

  const handleGuestLogin = async (values: { username: string; password: string }) => {
    setGuestLoading(true)
    try {
      const response = await authApi.guestLogin(values)
      if (response.data.success) {
        toast.success('Guest login successful')
        // Handle guest login success if needed
      }
    } catch (error: any) {
      console.error('Guest login error:', error)
      toast.error(error.response?.data?.message || 'Login failed')
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full mb-4">
            <LoginOutlined className="text-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            MFU Learn AI
          </h1>
          <p className="text-gray-600">
            Sign in to access your AI learning platform
          </p>
        </div>

        <Card className="shadow-lg border-0">
          <div className="space-y-6">
            {error === 'auth_failed' && (
              <Alert
                message="Authentication Failed"
                description="There was an error during the authentication process. Please try again."
                type="error"
                showIcon
                className="mb-4"
              />
            )}

            {/* SAML Login */}
            <div>
              <Button
                type="primary"
                size="large"
                block
                loading={loading}
                onClick={handleSamlLogin}
                className="h-12 text-base font-medium"
              >
                <div className="flex items-center justify-center space-x-2">
                  <UserOutlined />
                  <span>Sign in with MFU Account</span>
                </div>
              </Button>
              <p className="text-sm text-gray-500 text-center mt-2">
                Use your MFU credentials to sign in
              </p>
            </div>

            <Divider className="my-6">
              <span className="text-gray-400 text-sm">Or</span>
            </Divider>

            {/* Guest Login Form */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Guest Access
              </h3>
              <Form
                name="guest-login"
                onFinish={handleGuestLogin}
                layout="vertical"
                className="space-y-4"
              >
                <Form.Item
                  name="username"
                  label={<span className="text-gray-700 font-medium">Username</span>}
                  rules={[
                    { required: true, message: 'Please input your username!' }
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<UserOutlined className="text-gray-400" />}
                    placeholder="Enter username"
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label={<span className="text-gray-700 font-medium">Password</span>}
                  rules={[
                    { required: true, message: 'Please input your password!' }
                  ]}
                >
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined className="text-gray-400" />}
                    placeholder="Enter password"
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item className="mb-0">
                  <Button
                    type="default"
                    htmlType="submit"
                    size="large"
                    block
                    loading={guestLoading}
                    className="h-12 text-base font-medium border-gray-300 hover:border-blue-500 hover:text-blue-500"
                  >
                    Sign in as Guest
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        </Card>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2024 Mae Fah Luang University. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login 