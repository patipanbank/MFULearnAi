/**
 * Auth Service
 * Handles authentication, user management, departments, and admin functions
 */

import { api } from '../../shared/lib/api';
import { config } from '../../config/config';
import type {
  User,
  Department,
  UserSettings,
  SystemAnalytics,
  DepartmentStats
} from './types';

export class AuthService {
  private static get baseUrl(): string {
    return config.services.auth.apiPath;
  }

  // ==================== Authentication ====================

  /**
   * Get current user profile
   */
  static async getMe(): Promise<User> {
    return api.get<User>(`${this.baseUrl}/me`);
  }

  /**
   * Refresh authentication token
   */
  static async refreshToken(): Promise<{ token: string }> {
    return api.post<{ token: string }>(`${this.baseUrl}/refresh`);
  }

  /**
   * Logout (SAML)
   */
  static getSamlLogoutUrl(): string {
    return `${config.apiUrl}${this.baseUrl}/logout/saml`;
  }

  // ==================== User Settings ====================

  /**
   * Get user settings
   */
  static async getUserSettings(): Promise<UserSettings> {
    return api.get<UserSettings>(`${this.baseUrl}/user/settings`);
  }

  /**
   * Update user settings
   */
  static async updateUserSettings(settings: Partial<UserSettings>): Promise<void> {
    return api.put(`${this.baseUrl}/user/settings`, settings);
  }

  /**
   * Reset user settings to default
   */
  static async resetUserSettings(): Promise<void> {
    return api.post(`${this.baseUrl}/user/settings/reset`);
  }

  // ==================== Departments ====================

  /**
   * Get department by ID
   */
  static async getDepartment(id: string): Promise<Department> {
    return api.get<Department>(`${this.baseUrl}/departments/${id}`);
  }

  // ==================== Admin - Analytics ====================

  /**
   * Get system analytics (SuperAdmin only)
   */
  static async getAdminAnalytics(): Promise<SystemAnalytics> {
    return api.get<SystemAnalytics>(`${this.baseUrl}/admin/analytics`);
  }

  /**
   * Get department statistics (SuperAdmin only)
   */
  static async getDepartmentStats(): Promise<DepartmentStats> {
    return api.get<DepartmentStats>(`${this.baseUrl}/admin/departments/stats`);
  }

  // ==================== Admin - User Management ====================

  /**
   * Get all users (Admin only)
   */
  static async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    role?: string;
  }): Promise<{ users: User[]; total: number }> {
    return api.get(`${this.baseUrl}/admin/users`, { params });
  }

  /**
   * Create a new user (Admin only)
   */
  static async createAdminUser(userData: Partial<User>): Promise<User> {
    return api.post<User>(`${this.baseUrl}/admin/users`, userData);
  }

  /**
   * Update user (Admin only)
   */
  static async updateAdminUser(userId: string, userData: Partial<User>): Promise<User> {
    return api.put<User>(`${this.baseUrl}/admin/users/${userId}`, userData);
  }

  /**
   * Delete user (Admin only)
   */
  static async deleteAdminUser(userId: string): Promise<void> {
    return api.delete(`${this.baseUrl}/admin/users/${userId}`);
  }

  // ==================== Admin - Department Management ====================

  /**
   * Get all departments (Admin only)
   */
  static async getAdminDepartments(includeInactive: boolean = false): Promise<{
    departments: Department[];
  }> {
    return api.get(`${this.baseUrl}/admin/departments`, {
      params: { includeInactive }
    });
  }

  /**
   * Create a new department (SuperAdmin only)
   */
  static async createAdminDepartment(departmentData: Partial<Department>): Promise<Department> {
    return api.post<Department>(`${this.baseUrl}/admin/departments`, departmentData);
  }

  /**
   * Update department (SuperAdmin only)
   */
  static async updateAdminDepartment(
    departmentId: string,
    departmentData: Partial<Department>
  ): Promise<Department> {
    return api.put<Department>(`${this.baseUrl}/admin/departments/${departmentId}`, departmentData);
  }

  /**
   * Delete department (SuperAdmin only)
   */
  static async deleteAdminDepartment(departmentId: string): Promise<void> {
    return api.delete(`${this.baseUrl}/admin/departments/${departmentId}`);
  }

  /**
   * Recalculate department statistics (SuperAdmin only)
   */
  static async recalculateDepartments(): Promise<void> {
    return api.post(`${this.baseUrl}/admin/departments/recalculate`);
  }
}
