# Frontend Performance Optimization - Re-render Fixes

## 🔍 **ปัญหาที่พบ**

### **1. Store Functions ถูกสร้างใหม่ทุกครั้ง**
- Zustand store functions (เช่น `setIsMobile`, `toggleMobileMenu`) ถูกสร้างใหม่ทุกครั้งที่ store update
- ทำให้ components ที่ใช้ functions เหล่านี้ใน dependencies re-render ต่อเนื่อง

### **2. การใช้ Store Functions ใน useEffect Dependencies**
```typescript
// ปัญหาเดิม
useEffect(() => {
  // ...
}, [setIsMobile, setSidebarCollapsed]); // store functions ใน dependencies
```

### **3. การ Re-render แบบ Chain Reaction**
1. **Layout** re-render → **Header** re-render → **UserProfile** re-render
2. ทุกครั้งที่ user คลิก จะเกิด re-render 3 ครั้งพร้อมกัน
3. Store functions ถูกสร้างใหม่ → useEffect dependencies เปลี่ยน → re-render

## ✅ **การแก้ไขที่ทำแล้ว**

### **1. Layout Component (`frontend/src/shared/ui/Layout/index.tsx`)**
- ✅ Memoize store functions แยกออกจาก state
- ✅ ใช้ `useCallback` สำหรับ `handleResize`
- ✅ ใช้ `useMemo` สำหรับ conditional rendering components
- ✅ ลบ store functions ออกจาก useEffect dependencies

### **2. Header Component (`frontend/src/shared/ui/Layout/Header.tsx`)**
- ✅ Memoize computed values ด้วย `useMemo`
- ✅ Memoize event handlers ด้วย `useCallback`
- ✅ Memoize UI components เพื่อลดการ re-render

### **3. UserProfile Component (`frontend/src/shared/ui/UserProfile/index.tsx`)**
- ✅ Memoize event handlers และ utility functions
- ✅ Memoize UI components (profile button, dropdown content)
- ✅ ลบ dependencies ที่ไม่จำเป็นออกจาก useEffect

### **4. App Component (`frontend/src/app/App.tsx`)**
- ✅ ลบ store functions ออกจาก useEffect dependencies
- ✅ ใช้ store.getState() แทน store functions ใน dependencies

### **5. Layout Store (`frontend/src/shared/stores/layoutStore.ts`)**
- ✅ Memoize store functions เพื่อป้องกันการสร้างใหม่
- ✅ ใช้ explicit function declarations แทน arrow functions

### **6. UI Store (`frontend/src/shared/stores/uiStore.ts`)**
- ✅ Memoize store functions เพื่อป้องกันการสร้างใหม่
- ✅ ใช้ explicit function declarations แทน arrow functions

## 🚧 **ไฟล์ที่ยังต้องแก้ไข**

### **1. AgentSelector Component**
- มี syntax error จากการแก้ไข
- ต้องแก้ไขการ memoize functions และ dependencies

### **2. ChatPage Component**
- ต้องแก้ไขการ memoize functions และ dependencies
- ต้องลบ store functions ออกจาก useEffect dependencies

### **3. Stores อื่นๆ**
- `chatStore.ts` - ต้อง memoize functions
- `agentStore.ts` - ต้อง memoize functions
- `settingsStore.ts` - ต้อง memoize functions

## 📋 **แนวทางแก้ไขที่แนะนำ**

### **A. Memoize Store Functions**
```typescript
// ใช้ useCallback เพื่อ memoize functions
const handleResize = useCallback(() => {
  const mobile = window.innerWidth < 768;
  setIsMobile(mobile);
  if (mobile && !sidebarCollapsed) {
    setSidebarCollapsed(true);
  }
}, [setIsMobile, setSidebarCollapsed, sidebarCollapsed]);
```

### **B. ลบ Store Functions ออกจาก Dependencies**
```typescript
// แทนที่จะใช้ store functions ใน dependencies
useEffect(() => {
  // ใช้ store.getState() แทน
  const state = useLayoutStore.getState();
  // ...
}, []); // ไม่มี dependencies
```

### **C. ใช้ useMemo สำหรับ Computed Values**
```typescript
const showAgentSelector = useMemo(() => 
  location.pathname.startsWith('/chat'), 
  [location.pathname]
);
```

## 🎯 **ผลลัพธ์ที่คาดหวัง**

1. **ลดการ re-render** จาก 3 ครั้งต่อคลิก เหลือ 1 ครั้ง
2. **ปรับปรุง performance** ของ UI components
3. **ลดการใช้ memory** จากการสร้าง functions ใหม่
4. **เพิ่มความเสถียร** ของ application

## 🔄 **ขั้นตอนต่อไป**

1. แก้ไข AgentSelector component
2. แก้ไข ChatPage component
3. แก้ไข stores ที่เหลือ
4. ทดสอบ performance
5. ตรวจสอบ console logs เพื่อยืนยันการลด re-render 