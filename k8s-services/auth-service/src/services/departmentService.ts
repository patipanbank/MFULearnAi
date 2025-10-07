import axios from 'axios';
import config from '../config/config';

class DepartmentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.DEPARTMENT_SERVICE_URL || 'http://department-service:3002';
  }

  /**
   * Ensure department exists via HTTP call to department service
   */
  async ensureDepartmentExists(departmentKey: string, departmentName: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/departments/ensure`, {
        key: departmentKey,
        name: departmentName
      }, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error(`⚠️ Failed to ensure department exists: ${error}`);
      // Non-critical - continue even if department service is unavailable
      return null;
    }
  }

  /**
   * Notify department service when a new user is created
   */
  async onUserCreated(departmentKey: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/api/departments/${departmentKey}/increment`, {}, {
        timeout: 5000
      });
    } catch (error) {
      console.error(`⚠️ Failed to increment department count: ${error}`);
      // Non-critical - continue even if department service is unavailable
    }
  }

  /**
   * Notify department service when a user's department changes
   */
  async onUserDepartmentChanged(oldDepartmentKey: string, newDepartmentKey: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/api/departments/transfer`, {
        from: oldDepartmentKey,
        to: newDepartmentKey
      }, {
        timeout: 5000
      });
    } catch (error) {
      console.error(`⚠️ Failed to transfer user between departments: ${error}`);
      // Non-critical - continue even if department service is unavailable
    }
  }
}

export const departmentService = new DepartmentService();
