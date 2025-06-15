import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Spin, Alert } from 'antd'
import { useAuth } from '../contexts/AuthContext'

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processAuthCallback = async () => {
      try {
        const token = searchParams.get('token')
        const userDataEncoded = searchParams.get('user_data')
        const errorParam = searchParams.get('error')

        // Handle authentication errors
        if (errorParam) {
          throw new Error(getErrorMessage(errorParam))
        }

        // Validate required parameters
        if (!token) {
          throw new Error('Authentication token not found')
        }

        let userData = null
        if (userDataEncoded) {
          try {
            const decodedUserData = Buffer.from(userDataEncoded, 'base64').toString('utf-8')
            userData = JSON.parse(decodedUserData)
          } catch (error) {
            console.error('Error parsing user data:', error)
            // Continue without user data, will extract from token
          }
        }

        // Attempt login
        await login(token, userData)
        
        // Clear URL parameters for security
        window.history.replaceState({}, document.title, window.location.pathname)
        
        // Success - redirect to dashboard
        navigate('/', { replace: true })
        
      } catch (error: any) {
        console.error('Auth callback error:', error)
        setError(error.message || 'Authentication failed')
        
        // Redirect to login after error display
        setTimeout(() => {
          navigate('/login?error=auth_callback_failed', { replace: true })
        }, 3000)
      } finally {
        setLoading(false)
      }
    }

    processAuthCallback()
  }, [searchParams, login, navigate])

  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: { [key: string]: string } = {
      'auth_failed': 'Authentication failed. Please try again.',
      'invalid_saml_response': 'Invalid SAML response received.',
      'user_not_found': 'User account not found.',
      'access_denied': 'Access denied. You may not have permission to access this system.',
      'session_expired': 'Your session has expired. Please log in again.',
      'invalid_token': 'Invalid authentication token received.',
      'server_error': 'Server error occurred during authentication.',
      'network_error': 'Network error. Please check your connection and try again.',
    }
    
    return errorMessages[errorCode] || 'An unknown error occurred during authentication.'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <Spin size="large" />
          <h2 className="text-xl font-semibold text-gray-800 mt-4">
            Authenticating...
          </h2>
          <p className="text-gray-600 mt-2">
            Please wait while we verify your credentials
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <Alert
            message="Authentication Error"
            description={error}
            type="error"
            showIcon
            className="mb-4"
          />
          <div className="text-center">
            <p className="text-gray-600">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default AuthCallback 