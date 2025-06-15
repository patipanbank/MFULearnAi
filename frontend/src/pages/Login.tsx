import React, { useState, useEffect } from 'react'
import { Button, Card, Form, Input, Divider, Alert } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined, SafetyOutlined } from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../utils/api'
import toast from 'react-hot-toast'

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const error = searchParams.get('error')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSamlLogin = async () => {
    setLoading(true)
    try {
      // Store the current URL to redirect back after login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname)
      
      // Redirect to SAML login endpoint
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      window.location.href = `${apiUrl}/api/auth/login/saml`
    } catch (error) {
      console.error('SAML login error:', error)
      toast.error('Failed to initiate SAML login')
      setLoading(false)
    }
  }

  const handleGuestLogin = async (values: { username: string; password: string }) => {
    setGuestLoading(true)
    try {
      // Validate inputs
      if (!values.username.trim()) {
        throw new Error('Username is required')
      }
      if (!values.password.trim()) {
        throw new Error('Password is required')
      }

      const response = await authApi.guestLogin(values)
      
      if (response.data.success) {
        toast.success('Guest login successful')
        // Redirect will be handled by auth context
        const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/'
        sessionStorage.removeItem('redirectAfterLogin')
        navigate(redirectPath, { replace: true })
      } else {
        throw new Error(response.data.message || 'Login failed')
      }
    } catch (error: any) {
      console.error('Guest login error:', error)
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Login failed. Please check your credentials.'
      toast.error(errorMessage)
    } finally {
      setGuestLoading(false)
    }
  }

  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: { [key: string]: string } = {
      'auth_failed': 'Authentication failed. Please try again.',
      'auth_callback_failed': 'Authentication callback failed. Please try again.',
      'no_token': 'No authentication token received.',
      'invalid_token': 'Invalid authentication token.',
      'access_denied': 'Access denied. You may not have permission to access this system.',
      'session_expired': 'Your session has expired. Please log in again.',
      'server_error': 'Server error occurred. Please try again later.',
      'network_error': 'Network error. Please check your connection.',
    }
    
    return errorMessages[errorCode] || 'An error occurred during authentication.'
  }

  const handleRetryLogin = () => {
    // Clear error from URL
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('error')
    navigate(`${window.location.pathname}?${newSearchParams.toString()}`, { replace: true })
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
            {error && (
              <Alert
                message="Authentication Error"
                description={
                  <div>
                    <p className="mb-2">{getErrorMessage(error)}</p>
                    <Button size="small" type="link" onClick={handleRetryLogin} className="p-0">
                      Try again
                    </Button>
                  </div>
                }
                type="error"
                showIcon
                closable
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
                icon={<SafetyOutlined />}
              >
                Sign in with MFU Account
              </Button>
              <p className="text-sm text-gray-500 text-center mt-2">
                Use your MFU credentials to sign in securely
              </p>
            </div>

            <Divider className="my-6">
              <span className="text-gray-400 text-sm">Or</span>
            </Divider>

            {/* Guest Login Form */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Guest Login
              </h3>
              <Form
                layout="vertical"
                onFinish={handleGuestLogin}
                autoComplete="off"
              >
                <Form.Item
                  name="username"
                  label="Username"
                  rules={[
                    { required: true, message: 'Please enter your username' },
                    { min: 3, message: 'Username must be at least 3 characters' }
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Enter username"
                    size="large"
                    autoComplete="username"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: 'Please enter your password' },
                    { min: 6, message: 'Password must be at least 6 characters' }
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Enter password"
                    size="large"
                    autoComplete="current-password"
                  />
                </Form.Item>

                <Form.Item className="mb-0">
                  <Button
                    type="default"
                    htmlType="submit"
                    size="large"
                    block
                    loading={guestLoading}
                    className="h-12 text-base font-medium"
                  >
                    Sign in as Guest
                  </Button>
                </Form.Item>
              </Form>
              
              <p className="text-sm text-gray-500 text-center mt-3">
                Guest access with limited features
              </p>
            </div>
          </div>

          <Divider />

          {/* Security Notice */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our Terms of Service and Privacy Policy.
              <br />
              Your data is protected with enterprise-grade security.
            </p>
          </div>
        </Card>

        {/* Additional Help */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Need help? Contact{' '}
            <a
              href="mailto:support@mfu.ac.th"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              IT Support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login 