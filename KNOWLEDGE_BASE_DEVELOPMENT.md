# Knowledge Base Development Guide

## 📊 **ระบบ Knowledge Base ปัจจุบัน**

### ✅ **Features ที่มีอยู่แล้ว:**

#### **Backend Infrastructure**
- **Collection Management** - ระบบจัดการ collections พร้อม permission (PUBLIC/PRIVATE)
- **Document Processing** - รองรับไฟล์ PDF, DOCX, XLSX, CSV, TXT พร้อม OCR
- **Vector Database** - ChromaDB สำหรับเก็บ embeddings
- **Training Service** - ระบบอัพโหลดและ embed เอกสาร
- **Agent Integration** - เชื่อมต่อ collections กับ agents

#### **Frontend Components**
- **Knowledge Page** - หน้าจัดการ collections พร้อม analytics dashboard
- **Collection Modals** - สร้างและดูรายละเอียด collections
- **Upload Documents Modal** - อัพโหลดเอกสารแบบ drag & drop
- **Agent Modal** - เลือก collections สำหรับ agents

#### **API Endpoints**
- `GET /collections/` - ดึงรายการ collections
- `POST /collections/` - สร้าง collection ใหม่
- `PUT /collections/{id}` - แก้ไข collection
- `DELETE /collections/{id}` - ลบ collection
- `GET /collections/analytics` - ข้อมูลสถิติ collections
- `POST /training/upload` - อัพโหลดเอกสารสำหรับ training
- `POST /training/scrape-url` - scrape URL สำหรับ training
- `POST /training/text` - เพิ่มข้อความสำหรับ training

## 🚀 **แผนการพัฒนาต่อ**

### **Phase 1: ปรับปรุง UI/UX (เสร็จแล้ว)**
- ✅ Analytics Dashboard
- ✅ Enhanced Collection Cards
- ✅ Upload Documents Modal
- ✅ Better Error Handling

### **Phase 2: Advanced Features (แนะนำให้ทำต่อไป)**

#### **2.1 Document Management**
```typescript
// Features ที่ควรเพิ่ม:
- Document preview และ search
- Bulk operations (upload multiple files)
- Document versioning
- Document tagging และ categorization
- Document deduplication
```

#### **2.2 Collection Analytics**
```python
# Backend enhancements:
- Document count per collection
- Storage usage tracking
- Upload history
- Usage statistics
- Performance metrics
```

#### **2.3 Advanced Search**
```python
# Search features:
- Semantic search across collections
- Filter by document type, date, tags
- Search within document content
- Similarity search
```

### **Phase 3: Performance & Security**

#### **3.1 Performance Optimization**
```python
# Optimization strategies:
- Async document processing
- Batch embedding operations
- Caching mechanisms
- Database indexing
- Background processing queues
```

#### **3.2 Security & Compliance**
```python
# Security features:
- Document encryption
- Access control per document
- Audit trails
- Data retention policies
- GDPR compliance tools
```

## 🛠️ **การใช้งานระบบปัจจุบัน**

### **การสร้าง Collection**
1. ไปที่หน้า Knowledge Base
2. คลิก "New Collection"
3. ใส่ชื่อ collection และเลือก permission
4. คลิก "Create Collection"

### **การอัพโหลดเอกสาร**
1. คลิก "Upload Documents" หรือคลิกไอคอน upload บน collection
2. เลือก embedding model (แนะนำ Claude 3.5 Sonnet)
3. ลากไฟล์หรือคลิกเพื่อเลือกไฟล์
4. รองรับ PDF, DOCX, XLSX, CSV, TXT
5. คลิก "Upload Files"

### **การเชื่อมต่อกับ Agent**
1. ไปที่หน้า Agents
2. สร้างหรือแก้ไข agent
3. เลือก collections ที่ต้องการใช้
4. บันทึกการตั้งค่า

## 📁 **โครงสร้างไฟล์**

```
backend/
├── models/
│   ├── collection.py          # Collection model
│   └── training_history.py    # Training history model
├── services/
│   ├── collection_service.py  # Collection management
│   ├── chroma_service.py      # Vector database operations
│   ├── document_service.py    # Document processing
│   └── training_service.py    # Training operations
├── routes/
│   ├── collection.py          # Collection API endpoints
│   └── training.py            # Training API endpoints

frontend/
├── src/pages/KnowledgePage/
│   ├── index.tsx              # Main knowledge page
│   ├── CreateCollectionModal.tsx
│   ├── CollectionDetailModal.tsx
│   └── UploadDocumentsModal.tsx
```

## 🔧 **การตั้งค่าและ Deploy**

### **Requirements**
- Python 3.8+
- Node.js 16+
- MongoDB
- ChromaDB
- AWS Bedrock (สำหรับ embeddings)

### **Environment Variables**
```bash
# Backend
CHROMA_URL=http://localhost:8000
MONGODB_URL=mongodb://localhost:27017
BEDROCK_ACCESS_KEY=your_access_key
BEDROCK_SECRET_KEY=your_secret_key

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

### **การรัน Development**
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## 🎯 **แนวทางการพัฒนาต่อ**

### **1. Document Preview & Search**
```typescript
// เพิ่มใน CollectionDetailModal
- Document preview component
- Full-text search
- Filter by document type
- Sort by date, size, name
```

### **2. Bulk Operations**
```typescript
// เพิ่มใน UploadDocumentsModal
- Select multiple collections
- Batch upload to multiple collections
- Progress tracking per collection
- Error handling per file
```

### **3. Collection Analytics**
```python
# เพิ่มใน collection_service.py
- Document count tracking
- Storage usage calculation
- Upload frequency analysis
- Usage patterns
```

### **4. Advanced Search**
```python
# เพิ่มใน chroma_service.py
- Semantic search across collections
- Metadata filtering
- Date range search
- Content similarity search
```

## 📈 **Performance Monitoring**

### **Key Metrics**
- Document processing time
- Embedding generation speed
- Search response time
- Storage usage
- API response times

### **Monitoring Tools**
- Prometheus metrics
- Application logs
- Database performance
- Vector database health

## 🔒 **Security Considerations**

### **Data Protection**
- Encrypt sensitive documents
- Implement access controls
- Audit user actions
- Data retention policies

### **API Security**
- Rate limiting
- Input validation
- Authentication & authorization
- CORS configuration

## 🚀 **Next Steps**

1. **Implement Document Preview** - เพิ่มความสามารถในการดูเอกสาร
2. **Add Advanced Search** - ค้นหาขั้นสูง
3. **Bulk Operations** - การจัดการเอกสารแบบกลุ่ม
4. **Performance Optimization** - ปรับปรุงประสิทธิภาพ
5. **Security Enhancements** - เพิ่มความปลอดภัย

## 📞 **Support**

หากมีปัญหาหรือต้องการความช่วยเหลือ:
- ตรวจสอบ logs ใน backend และ frontend
- ดู API documentation ที่ `/docs`
- ตรวจสอบ ChromaDB และ MongoDB status
- ตรวจสอบ AWS Bedrock credentials 