import React, { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Spin } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const token = searchParams.get('token')
        const userDataEncoded = searchParams.get('user_data')
        
        if (!token) {
          toast.error('No authentication token received')
          navigate('/login?error=no_token')
          return
        }

        let userData = undefined
        if (userDataEncoded) {
          try {
            const decodedUserData = Buffer.from(userDataEncoded, 'base64').toString('utf-8')
            userData = JSON.parse(decodedUserData)
          } catch (error) {
            console.error('Error decoding user data:', error)
            // Continue without user data, will be extracted from token
          }
        }

        // Login with the received token and user data
        login(token, userData)
        
        // Navigate to chat page after successful login
        navigate('/chat')
        
      } catch (error) {
        console.error('Auth callback error:', error)
        toast.error('Authentication failed')
        navigate('/login?error=auth_failed')
      }
    }

    handleAuthCallback()
  }, [searchParams, navigate, login])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            className="text-blue-600"
          />
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Completing Sign In...
        </h2>
        <p className="text-gray-600">
          Please wait while we complete your authentication.
        </p>
      </div>
    </div>
  )
}

export default AuthCallback 