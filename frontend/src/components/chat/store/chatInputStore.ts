import { create } from 'zustand';
import { Message, MessageFile } from '../utils/types';

interface ChatInputState {
  // State
  inputMessage: string;
  selectedImageFiles: File[];
  selectedDocFiles: File[];
  existingImageFiles: MessageFile[];
  existingDocFiles: MessageFile[];
  isProcessingFiles: boolean;
  isEditing: boolean;
  editingMessage: Message | null;
  
  // Actions
  setInputMessage: (message: string) => void;
  setSelectedImageFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  setSelectedDocFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  setExistingImageFiles: (files: MessageFile[] | ((prev: MessageFile[]) => MessageFile[])) => void;
  setExistingDocFiles: (files: MessageFile[] | ((prev: MessageFile[]) => MessageFile[])) => void;
  setIsProcessingFiles: (value: boolean) => void;
  setIsEditing: (value: boolean) => void;
  setEditingMessage: (message: Message | null) => void;
  
  // File handling
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveSelectedImage: (index: number) => void;
  handleRemoveSelectedDoc: (index: number) => void;
  handleRemoveExistingImage: (index: number) => void;
  handleRemoveExistingDoc: (index: number) => void;
  
  // Editing
  handleStartEdit: (message: Message) => void;
  handleSaveEdit: (message: Message, onEditClick?: (message: Message) => void) => Promise<void>;
  handleCancelEdit: () => void;
  
  // Utility
  resetFileSelections: () => void;
}

export const useChatInputStore = create<ChatInputState>((set, get) => ({
  // Initial state
  inputMessage: '',
  selectedImageFiles: [],
  selectedDocFiles: [],
  existingImageFiles: [],
  existingDocFiles: [],
  isProcessingFiles: false,
  isEditing: false,
  editingMessage: null,
  
  // Basic state setters
  setInputMessage: (message) => set({ inputMessage: message }),
  setSelectedImageFiles: (filesOrFn) => {
    if (typeof filesOrFn === 'function') {
      set((state) => ({ selectedImageFiles: filesOrFn(state.selectedImageFiles) }));
    } else {
      set({ selectedImageFiles: filesOrFn });
    }
  },
  setSelectedDocFiles: (filesOrFn) => {
    if (typeof filesOrFn === 'function') {
      set((state) => ({ selectedDocFiles: filesOrFn(state.selectedDocFiles) }));
    } else {
      set({ selectedDocFiles: filesOrFn });
    }
  },
  setExistingImageFiles: (filesOrFn) => {
    if (typeof filesOrFn === 'function') {
      set((state) => ({ existingImageFiles: filesOrFn(state.existingImageFiles) }));
    } else {
      set({ existingImageFiles: filesOrFn });
    }
  },
  setExistingDocFiles: (filesOrFn) => {
    if (typeof filesOrFn === 'function') {
      set((state) => ({ existingDocFiles: filesOrFn(state.existingDocFiles) }));
    } else {
      set({ existingDocFiles: filesOrFn });
    }
  },
  setIsProcessingFiles: (value) => set({ isProcessingFiles: value }),
  setIsEditing: (value) => set({ isEditing: value }),
  setEditingMessage: (message) => set({ editingMessage: message }),
  
  // File handling
  handleFileSelect: (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // แยกไฟล์ตามประเภท
    const newImageFiles: File[] = [];
    const newDocFiles: File[] = [];
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        newImageFiles.push(file);
      } else {
        newDocFiles.push(file);
      }
    });
    
    set((state) => ({
      selectedImageFiles: [...state.selectedImageFiles, ...newImageFiles],
      selectedDocFiles: [...state.selectedDocFiles, ...newDocFiles]
    }));
  },
  
  handleRemoveSelectedImage: (index) => {
    set((state) => ({
      selectedImageFiles: state.selectedImageFiles.filter((_, i) => i !== index)
    }));
  },
  
  handleRemoveSelectedDoc: (index) => {
    set((state) => ({
      selectedDocFiles: state.selectedDocFiles.filter((_, i) => i !== index)
    }));
  },
  
  handleRemoveExistingImage: (index) => {
    set((state) => ({
      existingImageFiles: state.existingImageFiles.filter((_, i) => i !== index)
    }));
  },
  
  handleRemoveExistingDoc: (index) => {
    set((state) => ({
      existingDocFiles: state.existingDocFiles.filter((_, i) => i !== index)
    }));
  },
  
  // Editing
  handleStartEdit: (message) => {
    set({
      isEditing: true,
      editingMessage: message,
      inputMessage: message.content
    });
    
    // แยกการจัดเก็บไฟล์ภาพและเอกสารเดิม
    if (message.images && message.images.length > 0) {
      // แปลงโครงสร้างไฟล์ภาพให้เข้ากับรูปแบบที่ใช้ในการแก้ไข
      const imageFiles = message.images.map((image, index) => ({
        name: `รูปภาพ ${index + 1}`,
        data: image.data,
        mediaType: image.mediaType,
        size: 0
      }));
      set({ existingImageFiles: imageFiles });
    } else {
      set({ existingImageFiles: [] });
    }
    
    if (message.files && message.files.length > 0) {
      set({ existingDocFiles: message.files });
    } else {
      set({ existingDocFiles: [] });
    }
  },
  
  handleSaveEdit: async (message, onEditClick) => {
    const { inputMessage, selectedImageFiles, selectedDocFiles, existingImageFiles, existingDocFiles } = get();
    
    if (!inputMessage && !selectedImageFiles.length && !selectedDocFiles.length) {
      // ถ้าไม่มีข้อความหรือไฟล์ที่จะบันทึก ให้ยกเลิกการแก้ไข
      set({ isEditing: false });
      return;
    }
    
    // เริ่มประมวลผลไฟล์
    set({ isProcessingFiles: true });
    
    try {
      // อัปโหลดไฟล์ภาพใหม่
      const imageReadPromises: Promise<{ name: string; data: string; mediaType: string; size: number }>[] = 
        selectedImageFiles.map(file => {
          return new Promise<{ name: string; data: string; mediaType: string; size: number }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target && e.target.result) {
                const base64 = e.target.result.toString().split(',')[1];
                resolve({
                  name: file.name,
                  data: base64,
                  mediaType: file.type,
                  size: file.size
                });
              }
            };
            reader.readAsDataURL(file);
          });
        });

      // อัปโหลดไฟล์เอกสารใหม่
      const docReadPromises: Promise<{ name: string; data: string; mediaType: string; size: number }>[] = 
        selectedDocFiles.map(file => {
          return new Promise<{ name: string; data: string; mediaType: string; size: number }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target && e.target.result) {
                const base64 = e.target.result.toString().split(',')[1];
                resolve({
                  name: file.name,
                  data: base64,
                  mediaType: file.type,
                  size: file.size
                });
              }
            };
            reader.readAsDataURL(file);
          });
        });

      // รอให้อัปโหลดไฟล์ทั้งหมดเสร็จแล้วบันทึก
      const [newImageFiles, newDocFiles] = await Promise.all([
        Promise.all(imageReadPromises),
        Promise.all(docReadPromises)
      ]);
      
      // แยกรูปภาพตาม schema
      const allImages = existingImageFiles.map(file => ({
        data: file.data,
        mediaType: file.mediaType
      })).concat(newImageFiles.map(file => ({
        data: file.data,
        mediaType: file.mediaType
      })));
      
      // ไฟล์เอกสาร
      const allFiles = existingDocFiles.concat(newDocFiles);
      
      const editedMessage = {
        ...message,
        content: inputMessage,
        // แยกไฟล์ภาพและเอกสารตาม schema
        images: message.role === 'user' ? allImages : message.images,
        files: message.role === 'user' ? allFiles : message.files
      };
      
      if (onEditClick) {
        onEditClick(editedMessage);
      }
      
      // รีเซ็ตสถานะหลังจากการบันทึก
      get().resetFileSelections();
      set({
        isEditing: false,
        inputMessage: '',
        editingMessage: null,
        isProcessingFiles: false
      });
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการอัปโหลดไฟล์:', error);
      set({ isProcessingFiles: false });
    }
  },
  
  handleCancelEdit: () => {
    get().resetFileSelections();
    set({
      isEditing: false,
      inputMessage: '',
      editingMessage: null
    });
  },
  
  resetFileSelections: () => {
    set({
      selectedImageFiles: [],
      selectedDocFiles: [],
      existingImageFiles: [],
      existingDocFiles: []
    });
  }
})); 