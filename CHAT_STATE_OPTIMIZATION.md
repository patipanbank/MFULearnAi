# ChatPage State Management Optimization

## 🔍 **ปัญหาที่พบ**

### 1. **State Duplication และ Redundancy**
- Local state ซ้ำซ้อนกับ global store
- `isConnectedToRoom`, `isRoomCreating` อยู่ในทั้ง local state และ global store

### 2. **useEffect Dependencies มากเกินไป**
- Line 588: `[wsStatus, token, currentSession, isInChatRoom]` มี dependencies มาก
- ทำให้ re-render บ่อยเกินไป

### 3. **Ref Overuse สำหรับ State Management**
- มี ref หลายตัวที่ใช้จัดการ state แทนที่จะใช้ state management ที่เหมาะสม
- `currentSessionRef`, `chatHistoryRef`, `pendingQueueRef`, `pendingFirstRef`

### 4. **Complex WebSocket State Management**
- WebSocket logic กระจายอยู่ในหลายที่
- Token refresh logic ซับซ้อนและซ้ำซ้อน
- Error handling ไม่เป็นระบบ

## ✅ **การปรับปรุงที่ทำ**

### 1. **Consolidate State Management**
```typescript
// เพิ่ม state ใน chatStore
interface ChatState {
  // Room management state
  isConnectedToRoom: boolean;
  setIsConnectedToRoom: (connected: boolean) => void;
  isRoomCreating: boolean;
  setIsRoomCreating: (creating: boolean) => void;
}
```

### 2. **สร้าง Custom Hook สำหรับ Message Handling**
```typescript
// useMessageHandler.ts
export const useMessageHandler = () => {
  const abortStreaming = useCallback((reason: string) => { ... });
  const handleWebSocketMessage = useCallback((data: any) => { ... });
  const validateMessage = useCallback((message: string) => { ... });
  const createUserMessage = useCallback((content: string, images: Array<{ url: string; mediaType: string }> = []) => { ... });
  const createAssistantPlaceholder = useCallback(() => { ... });
  
  return {
    abortStreaming,
    handleWebSocketMessage,
    handleRoomCreated,
    validateMessage,
    createUserMessage,
    createAssistantPlaceholder
  };
};
```

### 3. **ลด Local State**
```typescript
// ก่อน
const [isConnectedToRoom, setIsConnectedToRoom] = useState(false);
const [isRoomCreating, setIsRoomCreating] = useState(false);

// หลัง - ใช้ global store แทน
const { 
  isConnectedToRoom, 
  setIsConnectedToRoom,
  isRoomCreating, 
  setIsRoomCreating 
} = useChatStore();
```

### 4. **ปรับปรุง useEffect Dependencies**
```typescript
// เพิ่ม dependencies ที่จำเป็น
useEffect(() => {
  // Auto-reconnect logic
}, [wsStatus, token, currentSession, isInChatRoom, isTokenExpired, addToast, connectWebSocket]);
```

## 🎯 **ประโยชน์ที่ได้**

### 1. **Performance Improvement**
- ลด re-render ที่ไม่จำเป็น
- State management ที่มีประสิทธิภาพมากขึ้น
- ลดการใช้ ref ที่ไม่จำเป็น

### 2. **Code Maintainability**
- แยก logic ออกจาก component หลัก
- Custom hooks ที่ reusable
- State management ที่เป็นระบบมากขึ้น

### 3. **Better Error Handling**
- Centralized error handling
- Token refresh logic ที่เป็นระบบ
- WebSocket connection management ที่ดีขึ้น

### 4. **Reduced Complexity**
- ลดความซับซ้อนของ ChatPage component
- แยก concerns ให้ชัดเจน
- Code ที่อ่านและเข้าใจง่ายขึ้น

## 📋 **Next Steps**

### 1. **สร้าง useWebSocket Hook**
- แยก WebSocket logic ออกจาก ChatPage
- Centralized WebSocket management
- Better error handling และ reconnection logic

### 2. **Optimize useEffect Dependencies**
- ใช้ useCallback สำหรับ functions ที่ใช้ใน useEffect
- ลด dependencies ที่ไม่จำเป็น
- ใช้ useMemo สำหรับ expensive calculations

### 3. **State Normalization**
- ปรับปรุง data structure ของ chat messages
- ลด nested state updates
- Optimize re-renders

### 4. **Add Error Boundaries**
- Error boundaries สำหรับ WebSocket errors
- Better user experience เมื่อเกิด errors
- Graceful degradation

## 🔧 **Implementation Status**

- ✅ Consolidate State Management
- ✅ Create useMessageHandler Hook
- ✅ Reduce Local State
- ✅ Improve useEffect Dependencies
- ⏳ Create useWebSocket Hook (in progress)
- ⏳ Optimize useEffect Dependencies (in progress)
- ⏳ State Normalization (pending)
- ⏳ Add Error Boundaries (pending) 