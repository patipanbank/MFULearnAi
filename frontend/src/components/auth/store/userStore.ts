import { create } from 'zustand';
import { config } from '../../../config/config';

export interface UserData {
    nameID: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    department: string;
    groups: string[];
}

interface AuthState {
    user: UserData | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    login: () => void;
    logout: () => void;
    checkAuth: () => void;
    setUser: (user: UserData | null) => void;
    setToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,

    checkAuth: () => {
        try {
            const userDataString = localStorage.getItem('user_data');
            const token = localStorage.getItem('auth_token');

            if (userDataString && token) {
                const user = JSON.parse(userDataString);
                set({ user, token, isAuthenticated: true, isLoading: false });
            } else {
                set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('Failed to parse user data:', error);
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
    },

    setUser: (user) => {
        if (user) {
            localStorage.setItem('user_data', JSON.stringify(user));
            set({ user });
            // Only set authenticated if we also have a token
            set((state) => ({ isAuthenticated: !!state.token }));
        } else {
            localStorage.removeItem('user_data');
            set({ user: null, isAuthenticated: false });
        }
    },

    setToken: (token) => {
        if (token) {
            localStorage.setItem('auth_token', token);
            set({ token });
            // Only set authenticated if we also have a user
            set((state) => ({ isAuthenticated: !!state.user }));
        } else {
            localStorage.removeItem('auth_token');
            set({ token: null, isAuthenticated: false });
        }
    },

    login: () => {
        window.location.href = `${config.apiUrl}/api/auth/login/saml`;
    },

    logout: () => {
        try {
            // Clear local storage
            localStorage.clear();
            // Clear cookies
            document.cookie = "MSISAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

            // Update state
            set({ user: null, token: null, isAuthenticated: false });

            // Open login page in new tab (legacy behavior preserved)
            window.open('https://mfulearnai.mfu.ac.th/login', '_blank');

            // Redirect to SAML logout
            window.location.href = `${config.apiUrl}/api/auth/logout/saml`;
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login';
        }
    }
}));
