import {create} from 'zustand';

interface User {
  username: string;
  role: 'admin' | 'user' | 'guest';
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  groups?: string[];
  nameID?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}));

export default useAuthStore; 