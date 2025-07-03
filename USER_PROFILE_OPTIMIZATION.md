# UserProfile และ Current User Data Optimization

## 🔍 **ปัญหาที่พบ**

### 1. **Inconsistent Import Paths**
```typescript
// UserProfile ใช้ path แบบเก่า
import useAuthStore from '../../../entities/user/store';

// ส่วนอื่นใช้ path แบบใหม่
import { useAuthStore } from '../../shared/stores';
```

### 2. **Missing Department Data**
```typescript
// UserProfile แสดง department เป็น hardcode
<div className="text-sm md:text-base text-primary">computer engineering</div>

// แต่ User interface มี department_id
department_id?: { $oid: string };
```

### 3. **Debug Console Log**
```typescript
// มี debug log ที่ไม่ควรอยู่ใน production
console.log('UserProfile - Current user data:', user);
```

### 4. **Potential Race Condition**
```typescript
// AuthGuard และ HomePage ทั้งคู่เรียก fetchUser
// อาจทำให้เกิด race condition
```

### 5. **Missing Error Handling**
- ไม่มี error boundary สำหรับ UserProfile
- ไม่มีการ handle กรณีที่ user data ไม่สมบูรณ์

## ✅ **การปรับปรุงที่ทำ**

### 1. **แก้ไข Import Path**
```typescript
// ก่อน
import useAuthStore from '../../../entities/user/store';
import useUIStore from '../../stores/uiStore';

// หลัง
import { useAuthStore, useUIStore } from '../../stores';
```

### 2. **ลบ Debug Console Log**
```typescript
// ลบ debug log ออก
// console.log('UserProfile - Current user data:', user);
```

### 3. **สร้าง useDepartment Hook**
```typescript
// useDepartment.ts
export const useDepartment = (departmentId?: string) => {
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) {
      setDepartment(null);
      return;
    }

    const fetchDepartment = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api.get<Department>(`/departments/${departmentId}`);
        setDepartment(data);
      } catch (err) {
        console.error('Failed to fetch department:', err);
        setError('Failed to load department information');
      } finally {
        setLoading(false);
      }
    };

    fetchDepartment();
  }, [departmentId]);

  return { department, loading, error };
};
```

### 4. **ปรับปรุง Department Display**
```typescript
// ก่อน - hardcode
<div className="text-sm md:text-base text-primary">computer engineering</div>

// หลัง - dynamic data
<div className="text-sm md:text-base text-primary">
  {departmentLoading ? (
    <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div>
  ) : (
    department?.name || 'Not specified'
  )}
</div>
```

### 5. **สร้าง Error Boundary**
```typescript
// UserProfileErrorBoundary.tsx
class UserProfileErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UserProfile Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 text-sm">U</span>
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-600">User Profile</p>
            <p className="text-xs text-gray-500">Error loading profile</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 🎯 **ประโยชน์ที่ได้**

### 1. **Consistency**
- Import paths ที่สอดคล้องกัน
- Code structure ที่เป็นมาตรฐาน

### 2. **Dynamic Data**
- Department data ที่มาจาก API จริง
- Loading states สำหรับ async data
- Fallback values เมื่อไม่มีข้อมูล

### 3. **Better Error Handling**
- Error boundary สำหรับ UserProfile
- Graceful degradation เมื่อเกิด error
- Better user experience

### 4. **Performance**
- ลด debug logs ที่ไม่จำเป็น
- Optimized re-renders
- Better memory management

### 5. **Maintainability**
- Code ที่อ่านและเข้าใจง่าย
- Separation of concerns
- Reusable hooks

## 📋 **Next Steps**

### 1. **Implement Error Boundary Usage**
```typescript
// ใน Layout/Header.tsx
<UserProfileErrorBoundary>
  <UserProfile />
</UserProfileErrorBoundary>
```

### 2. **Add User Data Validation**
```typescript
// สร้าง validation function สำหรับ user data
const validateUserData = (user: User | null): boolean => {
  return !!(user && user.email && user.firstName && user.lastName);
};
```

### 3. **Optimize Auth Store**
```typescript
// เพิ่ม caching สำหรับ user data
// เพิ่ม retry logic สำหรับ failed requests
// เพิ่ม optimistic updates
```

### 4. **Add User Profile Caching**
```typescript
// Cache department data
// Cache user preferences
// Implement stale-while-revalidate pattern
```

### 5. **Improve Loading States**
```typescript
// Skeleton loading สำหรับ UserProfile
// Progressive loading สำหรับ user data
// Better loading indicators
```

## 🔧 **Implementation Status**

- ✅ Fix Import Paths
- ✅ Remove Debug Logs
- ✅ Create useDepartment Hook
- ✅ Update Department Display
- ✅ Create Error Boundary
- ⏳ Implement Error Boundary Usage (pending)
- ⏳ Add User Data Validation (pending)
- ⏳ Optimize Auth Store (pending)
- ⏳ Add User Profile Caching (pending)
- ⏳ Improve Loading States (pending)

## 📊 **User Data Flow**

```
AuthGuard → fetchUser() → useAuthStore → UserProfile → useDepartment → Department API
    ↓
HomePage → fetchUser() → useAuthStore → UserProfile → useDepartment → Department API
    ↓
UserProfile → display user data + department data
```

## 🛡️ **Error Handling Strategy**

1. **Network Errors**: Retry with exponential backoff
2. **Authentication Errors**: Redirect to login
3. **Data Validation Errors**: Show fallback UI
4. **Component Errors**: Error boundary catches and shows fallback
5. **API Errors**: Toast notifications with retry options 