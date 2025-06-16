import api from './api';
import { AdminUser } from '../store/adminStore';

export const adminService = {
  getAdmins: async (): Promise<AdminUser[]> => {
    const response = await api.get('/admins');
    return response.data;
  },
  
  addAdmin: async (adminData: Omit<AdminUser, 'id' | 'createdAt'>): Promise<AdminUser> => {
    const response = await api.post('/admins', adminData);
    return response.data;
  },
}; 