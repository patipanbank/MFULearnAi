import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * Auth Service Client
 * HTTP client for JWT validation and user info
 */
export class AuthClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.AUTH_SERVICE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('📤 Auth service request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('❌ Auth service request error', {
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('📥 Auth service response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('❌ Auth service response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate JWT token locally
   * This is faster than calling auth service for every request
   */
  validateTokenLocal(token: string): {
    valid: boolean;
    decoded?: any;
    error?: string;
  } {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      return {
        valid: true,
        decoded,
      };
    } catch (error: any) {
      logger.warn('⚠️ Invalid JWT token', {
        error: error.message,
      });
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate JWT token via auth service
   * Use this for critical operations or when you need fresh user data
   */
  async validateTokenRemote(token: string): Promise<{
    valid: boolean;
    user?: any;
    error?: string;
  }> {
    try {
      const response = await this.client.post(
        '/api/auth/validate',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        valid: true,
        user: response.data.user,
      };
    } catch (error: any) {
      logger.warn('⚠️ Token validation failed', {
        error: error.message,
      });
      return {
        valid: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Get user info by user ID
   */
  async getUserInfo(userId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/users/${userId}`);
      return response.data;
    } catch (error: any) {
      logger.error('❌ Error getting user info', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken?: string;
    error?: string;
  }> {
    try {
      const response = await this.client.post('/api/auth/refresh', {
        refresh_token: refreshToken,
      });

      return {
        accessToken: response.data.access_token,
      };
    } catch (error: any) {
      logger.error('❌ Error refreshing token', {
        error: error.message,
      });
      return {
        error: error.response?.data?.error || error.message,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const authClient = new AuthClient();
