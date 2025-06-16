import {create} from 'zustand';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'admin';
  createdAt: string;
}

interface AdminState {
  admins: AdminUser[];
  isLoading: boolean;
  error: string | null;
  setAdmins: (admins: AdminUser[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const useAdminStore = create<AdminState>((set) => ({
  admins: [],
  isLoading: false,
  error: null,
  setAdmins: (admins) => set({ admins }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

export default useAdminStore; 