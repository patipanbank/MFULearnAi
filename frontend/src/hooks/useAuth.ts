import { useAuthStore } from '../components/auth/store/userStore';

interface User {
  username: string;
  role: string;
  groups?: string[];
  nameID: string;
  firstName: string;
  department?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export const useAuth = (): AuthState => {
  const { user, isLoading } = useAuthStore();

  if (!user) {
    return {
      user: null,
      isLoading,
      isStaff: false,
      isAdmin: false,
      isSuperAdmin: false,
    };
  }

  const groups = user.groups || [];

  // Transform store user to hook user interface if needed, or just use as is
  // The structure seems identical based on previous file content
  const mappedUser: User = {
    username: user.username,
    role: groups.includes('Admin') ? 'Admin' : groups.includes('Staffs') ? 'Staffs' : 'Students',
    groups: groups,
    nameID: user.nameID,
    firstName: user.firstName,
    department: user.department,
  };

  return {
    user: mappedUser,
    isLoading,
    isStaff: groups.includes('Staffs') || groups.includes('Admin'),
    isAdmin: groups.includes('Admin'),
    isSuperAdmin: groups.includes('SuperAdmin'),
  };
}; 