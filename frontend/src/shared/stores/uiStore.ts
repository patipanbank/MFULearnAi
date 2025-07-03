import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  createdAt: Date;
}

export interface Modal {
  id: string;
  type: string;
  title: string;
  data?: any;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  isRead: boolean;
  createdAt: Date;
  link?: string;
}

interface UIState {
  // Global loading
  isLoading: boolean;
  loadingMessage?: string;
  setLoading: (loading: boolean, message?: string) => void;
  
  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void;
  removeToast: (toastId: string) => void;
  clearToasts: () => void;
  
  // Modals
  modals: Modal[];
  openModal: (modal: Omit<Modal, 'id'>) => string;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  
  // Dropdowns & Popovers
  openDropdowns: Set<string>;
  toggleDropdown: (dropdownId: string) => void;
  closeDropdown: (dropdownId: string) => void;
  closeAllDropdowns: () => void;
  
  // File upload
  uploadProgress: { [fileId: string]: number };
  setUploadProgress: (fileId: string, progress: number) => void;
  removeUploadProgress: (fileId: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Global loading
  isLoading: false,
  loadingMessage: undefined,
  setLoading: (loading, message) => set({ isLoading: loading, loadingMessage: message }),
  
  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: new Date(),
      duration: toast.duration || 5000
    };
    
    set((state) => ({
      toasts: [...state.toasts, newToast]
    }));
    
    // Auto remove toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }
  },
  
  removeToast: (toastId) => set((state) => ({
    toasts: state.toasts.filter(toast => toast.id !== toastId)
  })),
  
  clearToasts: () => set({ toasts: [] }),
  
  // Modals
  modals: [],
  openModal: (modal) => {
    const id = `modal_${Date.now()}_${Math.random()}`;
    const newModal: Modal = { ...modal, id };
    
    set((state) => ({
      modals: [...state.modals, newModal]
    }));
    
    return id;
  },
  
  closeModal: (modalId) => set((state) => ({
    modals: state.modals.filter(modal => modal.id !== modalId)
  })),
  
  closeAllModals: () => set({ modals: [] }),
  
  // Notifications
  notifications: [],
  unreadCount: 0,
  
  addNotification: (notification) => {
    const id = `notification_${Date.now()}_${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
      isRead: false,
      createdAt: new Date()
    };
    
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));
  },
  
  markNotificationAsRead: (notificationId) => set((state) => {
    const notification = state.notifications.find(n => n.id === notificationId);
    if (!notification || notification.isRead) return state;
    
    return {
      notifications: state.notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1)
    };
  }),
  
  markAllNotificationsAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true })),
    unreadCount: 0
  })),
  
  removeNotification: (notificationId) => set((state) => {
    const notification = state.notifications.find(n => n.id === notificationId);
    const unreadCountDelta = notification && !notification.isRead ? 1 : 0;
    
    return {
      notifications: state.notifications.filter(n => n.id !== notificationId),
      unreadCount: Math.max(0, state.unreadCount - unreadCountDelta)
    };
  }),
  
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
  
  // Dropdowns & Popovers
  openDropdowns: new Set(),
  
  toggleDropdown: (dropdownId) => set((state) => {
    const newSet = new Set(state.openDropdowns);
    if (newSet.has(dropdownId)) {
      newSet.delete(dropdownId);
    } else {
      newSet.add(dropdownId);
    }
    return { openDropdowns: newSet };
  }),
  
  closeDropdown: (dropdownId) => set((state) => {
    const newSet = new Set(state.openDropdowns);
    newSet.delete(dropdownId);
    return { openDropdowns: newSet };
  }),
  
  closeAllDropdowns: () => set({ openDropdowns: new Set() }),
  
  // File upload
  uploadProgress: {},
  
  setUploadProgress: (fileId, progress) => set((state) => ({
    uploadProgress: {
      ...state.uploadProgress,
      [fileId]: Math.max(0, Math.min(100, progress))
    }
  })),
  
  removeUploadProgress: (fileId) => set((state) => {
    const { [fileId]: removed, ...rest } = state.uploadProgress;
    return { uploadProgress: rest };
  })
}));

// Helper functions for common toast patterns
export const showSuccessToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({ type: 'success', title, message });
};

export const showErrorToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({ type: 'error', title, message });
};

export const showWarningToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({ type: 'warning', title, message });
};

export const showInfoToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({ type: 'info', title, message });
};

export default useUIStore; 