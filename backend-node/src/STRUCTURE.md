# Backend Node.js - Source Structure Organization

## 📁 Current Structure Analysis

### **ปัญหาปัจจุบัน**
- ไฟล์ modules กระจายอยู่ใน root level
- ไม่มีการจัดกลุ่มตามหน้าที่
- ยากต่อการบำรุงรักษาและเพิ่มเติม

### **แผนการจัดระเบียบใหม่**

```
src/
├── 📁 modules/                    # Core Business Logic
│   ├── auth/                      # Authentication & Authorization
│   ├── chat/                      # Chat functionality
│   ├── agents/                    # AI Agent management
│   ├── embeddings/                # Vector operations
│   ├── collection/                # Document collections
│   ├── upload/                    # File management
│   ├── admin/                     # Admin functions
│   ├── department/                # Department management
│   ├── system-prompt/             # System prompt management
│   ├── training/                  # Training functionality
│   ├── users/                     # User management
│   └── stats/                     # Statistics & Analytics
│
├── 📁 infrastructure/             # Infrastructure Services
│   ├── bedrock/                   # AWS Bedrock integration
│   ├── redis/                     # Redis configuration
│   ├── storage/                   # Storage services
│   ├── queue/                     # Background job processing
│   ├── health/                    # Health check services
│   ├── monitoring/                # System monitoring
│   ├── security/                  # Security configuration
│   ├── ws/                        # WebSocket gateway
│   └── worker/                    # Background workers
│
├── 📁 services/                   # Shared Services
│   ├── cache.service.ts           # Caching service
│   ├── chroma.service.ts          # Vector database
│   ├── document-management.service.ts # Document handling
│   ├── document.service.ts        # Document processing
│   ├── embedding.service.ts       # Vector embeddings
│   ├── memory.service.ts          # Memory management
│   ├── streaming.service.ts       # Real-time streaming
│   └── vector-search.service.ts   # Vector search
│
├── 📁 common/                     # Shared Utilities
│   ├── decorators/                # Custom decorators
│   ├── exceptions/                # Custom exceptions
│   ├── filters/                   # Global filters
│   ├── interceptors/              # Request interceptors
│   ├── schemas/                   # Validation schemas
│   ├── services/                  # Common services
│   ├── utils/                     # Utility functions
│   └── *.ts                       # Common middleware & pipes
│
├── 📁 config/                     # Configuration
│   ├── database.config.ts         # Database configuration
│   ├── redis.config.ts            # Redis configuration
│   ├── aws.config.ts              # AWS configuration
│   └── app.config.ts              # Application configuration
│
├── 📁 types/                      # TypeScript Types
│   ├── auth.types.ts              # Authentication types
│   ├── chat.types.ts              # Chat types
│   ├── agent.types.ts             # Agent types
│   └── common.types.ts            # Common types
│
├── app.module.ts                  # Main application module
└── main.ts                        # Application entry point
```

## 🎯 Organization Benefits

### **1. Clear Separation of Concerns**
- **Modules**: Business logic และ domain-specific functionality
- **Infrastructure**: External services และ system configuration
- **Services**: Shared services ที่ใช้ร่วมกัน
- **Common**: Utilities และ shared components

### **2. Easier Maintenance**
- ง่ายต่อการค้นหาไฟล์
- ลดความซับซ้อนในการทำความเข้าใจ code
- ชัดเจนในการแยก responsibility

### **3. Scalability**
- ง่ายต่อการเพิ่ม modules ใหม่
- สามารถแยก services ออกเป็น microservices ได้
- ชัดเจนในการจัดการ dependencies

### **4. Developer Experience**
- ง่ายต่อการเรียนรู้สำหรับ developer ใหม่
- ชัดเจนในการทำงานของแต่ละส่วน
- ลด cognitive load ในการพัฒนา

## 🔧 Implementation Plan

### **Phase 1: Create New Structure**
1. สร้าง directories ใหม่
2. ย้ายไฟล์ไปยัง directories ที่เหมาะสม
3. อัปเดต import paths

### **Phase 2: Update References**
1. อัปเดต import statements
2. อัปเดต module registrations
3. ทดสอบการทำงาน

### **Phase 3: Cleanup**
1. ลบ directories เก่าที่ไม่ใช้
2. อัปเดต documentation
3. ตรวจสอบการทำงานทั้งหมด

## 📋 Migration Checklist

### **Modules to Move**
- [ ] auth → modules/auth
- [ ] chat → modules/chat
- [ ] agents → modules/agents
- [ ] embeddings → modules/embeddings
- [ ] collection → modules/collection
- [ ] upload → modules/upload
- [ ] admin → modules/admin
- [ ] department → modules/department
- [ ] system-prompt → modules/system-prompt
- [ ] training → modules/training
- [ ] users → modules/users
- [ ] stats → modules/stats

### **Infrastructure to Move**
- [ ] bedrock → infrastructure/bedrock
- [ ] redis → infrastructure/redis
- [ ] storage → infrastructure/storage
- [ ] queue → infrastructure/queue
- [ ] health → infrastructure/health
- [ ] monitoring → infrastructure/monitoring
- [ ] security → infrastructure/security
- [ ] ws → infrastructure/ws
- [ ] worker → infrastructure/worker

### **Services Already Organized**
- [x] services/ (already in correct place)
- [x] common/ (already in correct place)

## 🔄 Import Path Updates

### **Before**
```typescript
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AgentModule } from './agents/agent.module';
```

### **After**
```typescript
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agents/agent.module';
```

---

**Status**: Ready for implementation  
**Priority**: High (improves maintainability)  
**Impact**: Major (affects all imports)  
**Estimated Time**: 2-3 hours 