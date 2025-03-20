import { MessageFile } from './types';

export const compressImage = async (file: File): Promise<{ data: string; mediaType: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve({
          data: compressedBase64.split(',')[1],
          mediaType: 'image/jpeg'
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const readFileContent = async (file: File): Promise<string | null> => {
  // ประเภทไฟล์ที่อ่านเป็นข้อความได้
  const textTypes = [
    'text/plain', 'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/xml', 'text/csv', 
    'application/javascript', 'application/typescript',
    'text/markdown'
  ];
  
  // ตรวจสอบนามสกุลไฟล์
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const textExtensions = ['txt', 'md', 'json', 'csv', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'];
  
  // ถ้าเป็นไฟล์ข้อความ ให้อ่านด้วย FileReader ปกติ
  if (textTypes.includes(file.type) || textExtensions.includes(fileExt || '')) {
    try {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file);
      });
    } catch (error) {
      console.error('Error reading file content:', error);
      return null;
    }
  }
  
  // สำหรับไฟล์ PDF
  if (file.type === 'application/pdf' || fileExt === 'pdf') {
    try {
      // ส่งข้อมูล PDF ไปยัง backend เพื่อแปลง
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/chat/parse-file', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Cannot parse PDF file');
      }
      
      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      return `[Cannot read PDF file ${file.name} - Please check if the file is not locked and is not larger than 20MB]`;
    }
  }
  
  // สำหรับไฟล์ Word
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.type === 'application/msword' || 
      fileExt === 'docx' || fileExt === 'doc') {
    try {
      // ส่งข้อมูลไปยัง backend เพื่อแปลง
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/chat/parse-file', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Cannot parse Word document');
      }
      
      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Error parsing Word document:', error);
      return `[Cannot read Word document ${file.name} - Please check if the file is not locked and is not larger than 20MB]`;
    }
  }
  
  // สำหรับไฟล์ Excel
  if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.type === 'application/vnd.ms-excel' || 
      fileExt === 'xlsx' || fileExt === 'xls' || fileExt === 'csv') {
    try {
      // ส่งข้อมูลไปยัง backend เพื่อแปลง
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/chat/parse-file', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Cannot parse Excel file');
      }
      
      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return `[Cannot read Excel file ${file.name} - Please check if the file is not locked and is not larger than 20MB]`;
    }
  }
  
  // สำหรับไฟล์ PowerPoint
  if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
      file.type === 'application/vnd.ms-powerpoint' || 
      fileExt === 'pptx' || fileExt === 'ppt') {
    try {
      // ส่งข้อมูลไปยัง backend เพื่อแปลง
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/chat/parse-file', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Cannot parse PowerPoint file');
      }
      
      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Error parsing PowerPoint file:', error);
      return `[Cannot read PowerPoint file ${file.name} - Please check if the file is not locked and is not larger than 20MB]`;
    }
  }
  
  // สำหรับไฟล์ไบนารีอื่นๆ ที่ไม่รองรับ
  return `[File ${file.name} is a binary file type ${file.type} size ${Math.round(file.size/1024)} KB]`;
};

export const validateImageFile = (file: File): boolean => {
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('Image size must not exceed 20MB');
    return false;
  }
  return true;
};

export const prepareMessageFiles = async (files: File[], _selectedFiles: File[]): Promise<MessageFile[]> => {
  const messageFiles: MessageFile[] = [];
  
  for (const file of files) {
    const reader = new FileReader();
    const result = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsDataURL(file);
    });
    
    // อ่านเนื้อหาไฟล์
    const fileContent = await readFileContent(file);
    
    // แยกส่วน base64 จาก data URL
    const base64Data = result.split(',')[1];
    
    messageFiles.push({
      name: file.name,
      data: base64Data,
      mediaType: file.type,
      size: file.size,
      content: fileContent || undefined // เพิ่มเนื้อหาไฟล์
    });
  }
  
  return messageFiles;
}; 