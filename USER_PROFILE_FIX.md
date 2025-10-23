# User Profile System Fix

## ปัญหาที่พบ (Problem Identified)

SAML login สำเร็จแต่ข้อมูล user profile ไม่แสดงใน frontend เนื่องจาก:

### 1. **Type Mismatch ระหว่าง Backend และ Frontend**

**Backend** (`services/auth-service/src/routes/auth.ts:450-472`) ส่งข้อมูลในรูปแบบ MongoDB:

```typescript
const userResponse = {
  _id: { $oid: user.sub || user._id },  // MongoDB ObjectId format
  nameID: user.nameID,
  username: user.username,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  department: user.department,
  role: user.role,
  groups: user.groups || [],
  tokenQuota: user.tokenQuota || 100000,
  dailyTokenLimit: user.dailyTokenLimit || 50000,
  created: user.created || new Date(),
  updated: user.updated || new Date()
};
```

**Frontend** (`shared/types/index.ts`) expect แบบ simplified format และไม่มี handler สำหรับ MongoDB format

### 2. **authStore ไม่ Normalize Data**

Frontend authStore fetch user data แล้วไม่มีการแปลง MongoDB format ให้เป็นรูปแบบที่ใช้งานได้

### 3. **ไม่มี User Profile Page**

ระบบไม่มีหน้าแสดงข้อมูล user profile

---

## การแก้ไข (Solutions Implemented)

### 1. ปรับปรุง User Type Definition

**ไฟล์:** `frontend/src/shared/types/index.ts`

```typescript
export interface User {
  _id: { $oid: string } | string;  // รองรับทั้ง MongoDB format และ string
  id?: string;                      // เพิ่ม id field สำหรับใช้งานง่าย
  nameID: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role: 'Admin' | 'Staffs' | 'Students' | 'SuperAdmin';
  groups: string[];
  tokenQuota?: number;
  dailyTokenLimit?: number;
  created: Date | MongoDBDate | string;     // รองรับหลายรูปแบบ
  updated: Date | MongoDBDate | string;
  lastLogin?: Date | MongoDBDate | string;
  usage?: {
    total_tokens: number;
    total_requests: number;
  };
}

/**
 * Helper function to normalize User data from backend
 */
export function normalizeUser(user: any): User {
  return {
    ...user,
    id: typeof user._id === 'object' && user._id.$oid ? user._id.$oid : user._id || user.id,
    created: user.created?.$date || user.created,
    updated: user.updated?.$date || user.updated,
    lastLogin: user.lastLogin?.$date || user.lastLogin,
  };
}
```

**ประโยชน์:**
- ✅ รองรับ MongoDB ObjectId format `{ $oid: "..." }`
- ✅ รองรับ string format `"..."`
- ✅ มี `normalizeUser()` helper function แปลงข้อมูล
- ✅ เพิ่ม `id` field สำหรับการใช้งานง่าย

---

### 2. ปรับปรุง authStore

**ไฟล์:** `frontend/src/entities/user/store/index.ts`

```typescript
import { normalizeUser } from '../../../shared/types';

// ... in fetchUser()
try {
  const userData = await AuthService.getMe();
  console.log('fetchUser: Successfully fetched user data:', userData);

  // Normalize user data from backend format
  const normalizedUser = normalizeUser(userData);
  console.log('fetchUser: Normalized user data:', normalizedUser);

  set({ status: 'authenticated', user: normalizedUser, fetchError: null });
} catch (error) {
  // ... error handling
}
```

**ประโยชน์:**
- ✅ แปลง MongoDB format เป็น format ที่ใช้งานได้
- ✅ Extract `id` จาก `_id.$oid`
- ✅ แปลง date formats
- ✅ Log ข้อมูลสำหรับ debugging

---

### 3. สร้าง User Profile Page

**ไฟล์:** `frontend/src/pages/ProfilePage/index.tsx`

**Features:**

#### 📊 **Profile Overview Card**
- Avatar ด้วย initials
- ชื่อ-นามสกุล
- Email
- Role badge พร้อม color coding

#### 📋 **Information Sections**

1. **Basic Information**
   - Username
   - Email
   - First Name
   - Last Name

2. **Organization**
   - Department
   - Role
   - Groups count

3. **Usage & Limits**
   - Token Quota
   - Daily Token Limit
   - Total Usage (tokens)
   - Total Requests

4. **Account Information**
   - Created date
   - Last Updated date
   - Last Login date

#### 🎨 **UI/UX Features**
- ✅ Responsive design
- ✅ Dark mode support
- ✅ Loading states
- ✅ Error handling
- ✅ Refresh button
- ✅ Development debug info

---

### 4. เพิ่ม Profile Route

**ไฟล์:** `frontend/src/app/App.tsx`

```typescript
import ProfilePage from '../pages/ProfilePage';

// ... in Routes
<Route path="/profile" element={<ProfilePage />} />
```

---

### 5. เพิ่ม Profile Link ใน Sidebar

**ไฟล์:** `frontend/src/shared/ui/Layout/Sidebar.tsx`

เพิ่ม "My Profile" ใน Settings dropdown:

```typescript
const settingsItems = [
  {
    id: 'profile',
    label: 'My Profile',
    icon: FiUser,
    description: 'View your account information',
    type: 'route',
    path: '/profile',
    iconColor: iconColors.user
  },
  // ... other items
];
```

---

## API Response Format

### Backend Response (`/api/auth/me`)

```json
{
  "_id": { "$oid": "507f1f77bcf86cd799439011" },
  "nameID": "john.doe@example.com",
  "username": "john.doe",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "department": "Engineering",
  "role": "Staffs",
  "groups": ["S-1-5-21-..."],
  "tokenQuota": 100000,
  "dailyTokenLimit": 50000,
  "created": "2024-01-01T00:00:00Z",
  "updated": "2024-01-15T00:00:00Z"
}
```

### Frontend Normalized Format

```typescript
{
  _id: { $oid: "507f1f77bcf86cd799439011" },
  id: "507f1f77bcf86cd799439011",  // Extracted for easy use
  nameID: "john.doe@example.com",
  username: "john.doe",
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe",
  department: "Engineering",
  role: "Staffs",
  groups: ["S-1-5-21-..."],
  tokenQuota: 100000,
  dailyTokenLimit: 50000,
  created: "2024-01-01T00:00:00Z",
  updated: "2024-01-15T00:00:00Z"
}
```

---

## การใช้งาน (Usage)

### 1. เข้าถึง Profile Page

**ผ่าน Sidebar:**
1. คลิก Settings icon ที่ Sidebar
2. เลือก "My Profile"

**ผ่าน URL:**
- Navigate ไปที่ `/profile`

### 2. ดูข้อมูล User Profile

Profile page จะแสดง:
- ✅ ข้อมูลพื้นฐาน (username, email, ชื่อ-นามสกุล)
- ✅ ข้อมูลองค์กร (department, role, groups)
- ✅ Usage statistics (token usage, requests)
- ✅ Account information (created date, last login)

### 3. Refresh Profile Data

คลิกปุ่ม "Refresh" มุมขวาบนเพื่ออัพเดทข้อมูล

---

## การ Debug

### 1. เช็ค User Data ใน Console

```javascript
// Open browser console
console.log('User:', useAuthStore.getState().user);
```

### 2. ดู Raw Data (Development Mode)

Profile page จะแสดง debug section ด้านล่างใน development mode:

```json
{
  "_id": { "$oid": "..." },
  "username": "...",
  ...
}
```

### 3. เช็ค API Response

```bash
# เช็ค /me endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" http://10.1.44.204/api/auth/me
```

---

## Testing Checklist

- [x] User login via SAML สำเร็จ
- [x] User data ถูก fetch และ normalize
- [x] Profile page แสดงข้อมูลครบถ้วน
- [x] Profile link ปรากฏใน Sidebar
- [x] Responsive design ทำงานถูกต้อง
- [x] Dark mode support
- [x] Error handling ทำงานถูกต้อง
- [x] Refresh functionality ทำงานถูกต้อง

---

## ปัญหาที่อาจพบ (Potential Issues)

### 1. User data is null

**สาเหตน:**
- Token หมดอายุ
- API endpoint ไม่ทำงาน
- Network error

**วิธีแก้:**
1. เช็ค token ใน localStorage
2. เช็ค API response ใน Network tab
3. ลอง refresh หน้าเพื่อ re-fetch user data

### 2. ข้อมูลไม่แสดงครบ

**สาเหตน:**
- Backend ไม่ส่งข้อมูลบาง field
- Type mismatch

**วิธีแก้:**
1. เช็ค backend response ว่ามี field อะไรบ้าง
2. ดู console logs
3. อัพเดท User type definition ถ้าจำเป็น

### 3. Date format ผิด

**สาเหตน:**
- Backend ส่ง MongoDB date format `{ $date: "..." }`

**วิธีแก้:**
- `normalizeUser()` function จะ handle automatically

---

## Best Practices Applied

### 1. Type Safety
- ✅ Strict TypeScript types
- ✅ Type guards
- ✅ Proper interfaces

### 2. Error Handling
- ✅ Try-catch blocks
- ✅ Loading states
- ✅ Error messages
- ✅ Fallback UI

### 3. Code Organization
- ✅ Separation of concerns
- ✅ Reusable components
- ✅ Helper functions
- ✅ Clean code structure

### 4. User Experience
- ✅ Loading indicators
- ✅ Error feedback
- ✅ Refresh functionality
- ✅ Responsive design
- ✅ Dark mode support

---

## Next Steps (Optional Improvements)

### 1. Edit Profile Functionality
- Allow users to update their profile information
- Add profile picture upload

### 2. Activity History
- Show recent login history
- Display usage history charts

### 3. Notification Preferences
- Email notifications
- In-app notifications
- Notification frequency settings

### 4. Security Settings
- Change password
- Two-factor authentication
- Active sessions management

### 5. Export Data
- Export user data (GDPR compliance)
- Download usage reports

---

## สรุป (Summary)

การแก้ไขนี้แก้ปัญหา type mismatch ระหว่าง backend และ frontend โดย:

1. ✅ เพิ่ม type flexibility สำหรับ User interface
2. ✅ สร้าง normalizeUser() helper function
3. ✅ ปรับปรุง authStore ให้ normalize data
4. ✅ สร้าง Profile page ที่สมบูรณ์
5. ✅ เพิ่ม navigation route
6. ✅ เพิ่ม link ใน Sidebar

ตอนนี้ระบบ user profile ทำงานได้ถูกต้องและแสดงข้อมูลครบถ้วนแล้ว! 🎉

---

**Last Updated:** $(date)
**Version:** 1.0.0
**Authors:** Claude Code + MFU Learn AI Team
