import React, { useState, useRef } from 'react';
import { VscDebugContinue } from "react-icons/vsc";
import { MdEdit, MdRefresh, MdClose, MdContentCopy } from "react-icons/md";
import { FaSpinner } from "react-icons/fa";
import { RiFileAddFill, RiCloseLine } from 'react-icons/ri';
import { Message, MessageFile } from '../utils/types';
import MessageContent from './MessageContent';
import LoadingDots from './LoadingDots';
import { formatMessageTime } from '../utils/formatters';
import FileIcon from './FileIcon';

interface ChatBubbleProps {
  message: Message;
  isLastMessage: boolean;
  isLoading: boolean;
  onContinueClick: (e: React.MouseEvent) => void;
  onCancelClick?: (e: React.MouseEvent) => void;
  onEditClick?: (message: Message) => void;
  onRegenerateClick?: (e: React.MouseEvent, index?: number) => void;
  selectedModel: string;
  messageIndex?: number;
  isLastAssistantMessage?: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isLoading, 
  onContinueClick, 
  onEditClick,
  onRegenerateClick,
  selectedModel,
  messageIndex = 0,
  isLastAssistantMessage = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedDocFiles, setSelectedDocFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingImageFiles, setExistingImageFiles] = useState<MessageFile[]>([]);
  const [existingDocFiles, setExistingDocFiles] = useState<MessageFile[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const handleStartEdit = () => {
    setEditedContent(message.content);
    setIsEditing(true);
    
    // แยกไฟล์ตามประเภท (ภาพ vs เอกสาร)
    if (message.files && message.files.length > 0) {
      const images: MessageFile[] = [];
      const docs: MessageFile[] = [];
      
      message.files.forEach(file => {
        if (file.mediaType.startsWith('image/')) {
          images.push(file);
        } else {
          docs.push(file);
        }
      });
      
      setExistingImageFiles(images);
      setExistingDocFiles(docs);
    }
  };

  const handleSaveEdit = () => {
    if (onEditClick && editedContent.trim() !== '') {
      // ตรวจสอบว่าต้องเพิ่มไฟล์ใหม่หรือไม่
      if (message.role === 'user' && (selectedImageFiles.length > 0 || selectedDocFiles.length > 0)) {
        // แสดงสถานะกำลังประมวลผลไฟล์
        setIsProcessingFiles(true);
        
        // สร้าง Promise สำหรับอ่านไฟล์ภาพทั้งหมด
        const imageReadPromises = selectedImageFiles.map(file => {
          return new Promise<MessageFile>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: file.name,
                size: file.size,
                mediaType: file.type,
                data: (reader.result as string).split(',')[1] || '',
              });
            };
            reader.readAsDataURL(file);
          });
        });
        
        // สร้าง Promise สำหรับอ่านไฟล์เอกสารทั้งหมด
        const docReadPromises = selectedDocFiles.map(file => {
          return new Promise<MessageFile>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: file.name,
                size: file.size,
                mediaType: file.type,
                data: (reader.result as string).split(',')[1] || '',
              });
            };
            reader.readAsDataURL(file);
          });
        });
        
        // อ่านข้อมูลไฟล์ทั้งหมดและส่งข้อความ
        Promise.all([...imageReadPromises, ...docReadPromises])
          .then(newFileData => {
            // รวมไฟล์เก่าและไฟล์ใหม่ทั้งหมด
            const allFiles = [...existingImageFiles, ...existingDocFiles, ...newFileData];
            
            const editedMessage = {
              ...message,
              content: editedContent,
              files: message.role === 'user' ? allFiles : message.files
            };
            onEditClick(editedMessage);
            setIsEditing(false);
            setIsProcessingFiles(false);
          })
          .catch(error => {
            console.error('เกิดข้อผิดพลาดในการอ่านไฟล์:', error);
            setIsProcessingFiles(false);
          });
        
        return; // ออกจากฟังก์ชันเพื่อรอให้ Promise ทำงานเสร็จ
      }
      
      // กรณีไม่มีไฟล์ใหม่ หรือไม่ใช่ข้อความของ user
      const editedMessage = { 
        ...message, 
        content: editedContent,
        files: message.role === 'user' ? [...existingImageFiles, ...existingDocFiles] : message.files
      };
      onEditClick(editedMessage);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSelectedImageFiles([]);
    setSelectedDocFiles([]);
    setExistingImageFiles([]);
    setExistingDocFiles([]);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRegenerateClick = (e: React.MouseEvent) => {
    if (onRegenerateClick) {
      onRegenerateClick(e, messageIndex);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    setSelectedImageFiles(prev => [...prev, ...newImageFiles]);
    setSelectedDocFiles(prev => [...prev, ...newDocFiles]);
  };

  const handleRemoveSelectedImage = (index: number) => {
    setSelectedImageFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleRemoveSelectedDoc = (index: number) => {
    setSelectedDocFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleRemoveExistingImage = (index: number) => {
    setExistingImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingDoc = (index: number) => {
    setExistingDocFiles(prev => prev.filter((_, i) => i !== index));
  };

  // แยก Canvas สำหรับ User และ Assistant
  const renderEditCanvas = () => {
    if (message.role === 'user') {
      return renderUserEditCanvas();
    } else {
      return renderAssistantEditCanvas();
    }
  };

  // Canvas สำหรับแก้ไขข้อความของ User (รองรับการอัพโหลดไฟล์)
  const renderUserEditCanvas = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              แก้ไขข้อความผู้ใช้
            </h3>
            <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              <MdClose className="h-6 w-6" />
            </button>
          </div>
          
          <div className="p-4 flex-grow overflow-auto">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full min-h-[200px] p-3 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              placeholder="แก้ไขข้อความของคุณ..."
            />
          </div>

          {/* ส่วนอัพโหลดไฟล์ใหม่ */}
          <div className="px-4 pb-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.ppt,.pptx"
              multiple
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
            >
              <RiFileAddFill className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              <span className="text-xs text-gray-700 dark:text-gray-300">แนบไฟล์</span>
            </button>
          </div>
          
          {/* แสดงไฟล์ที่เลือกและไฟล์เดิม */}
          {(selectedImageFiles.length > 0 || selectedDocFiles.length > 0 || existingImageFiles.length > 0 || existingDocFiles.length > 0) && (
            <div className="flex flex-wrap gap-2 px-4 pb-2 mt-2">
              <div className="w-full text-xs text-gray-500 dark:text-gray-400 mb-1">
                ไฟล์แนบ ({selectedImageFiles.length + selectedDocFiles.length + existingImageFiles.length + existingDocFiles.length})
              </div>
              
              {/* ไฟล์ภาพเดิม */}
              {existingImageFiles.map((image, index) => (
                <div key={`existing-img-${index}`} className="relative">
                  <img
                    src={`data:${image.mediaType};base64,${image.data}`}
                    alt={`Image ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    <RiCloseLine />
                  </button>
                </div>
              ))}
              
              {/* ไฟล์เอกสารเดิม */}
              {existingDocFiles.map((file, index) => (
                <div key={`existing-doc-${index}`} className="relative">
                  <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <FileIcon fileName={file.name} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 rounded-b-lg">
                    <div className="px-1 py-0.5 text-white text-[8px] truncate">
                      {file.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingDoc(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    <RiCloseLine />
                  </button>
                </div>
              ))}
              
              {/* ไฟล์ภาพใหม่ */}
              {selectedImageFiles.map((image, index) => (
                <div key={`new-img-${index}`} className="relative">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Image ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSelectedImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    <RiCloseLine />
                  </button>
                </div>
              ))}
              
              {/* ไฟล์เอกสารใหม่ */}
              {selectedDocFiles.map((file, index) => (
                <div key={`new-doc-${index}`} className="relative">
                  <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <FileIcon fileName={file.name} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 rounded-b-lg">
                    <div className="px-1 py-0.5 text-white text-[8px] truncate">
                      {file.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSelectedDoc(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    <RiCloseLine />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 border rounded-md text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              disabled={isProcessingFiles}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center gap-2"
              disabled={isProcessingFiles}
            >
              {isProcessingFiles ? (
                <>
                  <FaSpinner className="animate-spin h-4 w-4" />
                  <span>กำลังประมวลผล...</span>
                </>
              ) : (
                <span>บันทึกและส่งใหม่</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Canvas สำหรับแก้ไขข้อความของ Assistant (ไม่อนุญาตให้อัพโหลดไฟล์เพิ่ม)
  const renderAssistantEditCanvas = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              แก้ไขข้อความแชทบอท
            </h3>
            <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              <MdClose className="h-6 w-6" />
            </button>
          </div>
          
          <div className="p-4 flex-grow overflow-auto">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full min-h-[300px] p-3 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              placeholder="แก้ไขข้อความของแชทบอท..."
            />
          </div>
          
          {/* แสดงไฟล์ที่มีอยู่ (แบบอ่านอย่างเดียว) */}
          {message.files && message.files.length > 0 && (
            <div className="px-4 pb-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ไฟล์แนบ:</h4>
              <div className="flex flex-wrap gap-2">
                {message.files.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                    <span className="text-xs truncate max-w-[150px]">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 border rounded-md text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ปรับปรุงการแสดงไฟล์แนบในข้อความ
  const renderAttachedFiles = () => {
    const hasImages = message.images && message.images.length > 0;
    const hasFiles = message.files && message.files.length > 0;
    
    if (!hasImages && !hasFiles) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {/* แสดงรูปภาพจากฟิลด์ images โดยเฉพาะ */}
        {hasImages && message.images!.map((image, index) => (
          <div key={`img-${index}`} className="relative">
            <img
              src={`data:${image.mediaType};base64,${image.data}`}
              alt={`รูปภาพ ${index + 1}`}
              className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
            />
          </div>
        ))}
        
        {/* แสดงไฟล์เอกสารจากฟิลด์ files */}
        {hasFiles && message.files!.map((file, index) => (
          <div key={`doc-${index}`} className="relative">
            <div className="w-24 h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <FileIcon fileName={file.name} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 rounded-b-lg">
              <div className="px-1 py-0.5 text-white text-xs truncate">
                {file.name}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="message relative">
      {isEditing && renderEditCanvas()}

      <div className={`flex items-start gap-3 ${
        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
      }`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ${
          message.role === 'user'
            ? 'bg-gradient-to-r from-red-600 to-yellow-400'
            : 'bg-transparent'
        } flex items-center justify-center`}>
          {message.role === 'user' ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          ) : (
            <img
              src="/dindin.PNG"
              alt="AI Assistant"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className={`flex flex-col space-y-2 max-w-[80%] ${
          message.role === 'user' ? 'items-end' : 'items-start'
        }`}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatMessageTime(message.timestamp)}
          </div>
          <div className={`rounded-lg p-3 ${
            message.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
          }`}>
            {message.role === 'assistant' && message.content === '' && isLoading ? (
              <LoadingDots />
            ) : (
              <div className="flex flex-col">
                <MessageContent message={message} />
                {renderAttachedFiles()}
              </div>
            )}
          </div>
        </div>
      </div>

      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
        <div className="ml-11 mt-1">
          <button
            onClick={() => {
              const sourceInfo = message.sources?.map(source =>
                `Model: ${source.modelId}\n` +
                `Collection: ${source.collectionName}\n` +
                `File: ${source.filename}\n` +
                `Source: ${source.source || 'N/A'}\n` +
                `Similarity: ${(source.similarity * 100).toFixed(1)}%`
              ).join('\n\n');
              alert(sourceInfo);
            }}
            className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ดูแหล่งข้อมูล ({message.sources.length})
          </button>
        </div>
      )}

      {/* Action buttons for assistant messages */}
      {message.role === 'assistant' && message.isComplete && (
        <div className="ml-11 mt-2 flex flex-wrap gap-2">
          {/* Continue button - แสดงเมื่อเป็นข้อความ assistant ล่าสุด */}
          {isLastAssistantMessage && (
            <button
              type="button"
              onClick={onContinueClick}
              className={`p-2 rounded-md transition-colors ${
                selectedModel 
                  ? 'text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400' 
                  : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
              disabled={!selectedModel}
              title="Continue"
              data-verify="false"
            >
              <VscDebugContinue className="h-5 w-5" />
            </button>
          )}
          
          {/* Regenerate button - for all assistant messages */}
          {onRegenerateClick && (
            <button
              type="button"
              onClick={handleRegenerateClick}
              className={`p-2 rounded-md transition-colors ${
                selectedModel 
                  ? 'text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400' 
                  : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
              disabled={!selectedModel}
              title={isLastAssistantMessage ? "สร้างคำตอบใหม่" : "ลบประวัติสนทนาที่ใหม่กว่าและสร้างคำตอบใหม่"}
            >
              <MdRefresh className="h-5 w-5" />
            </button>
          )}
          
          {/* Copy to clipboard button */}
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className="p-2 rounded-md transition-colors text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
            title={isCopied ? "คัดลอกแล้ว!" : "คัดลอกข้อความ"}
          >
            <MdContentCopy className="h-5 w-5" />
          </button>
          
          {/* Edit button */}
          <button
            type="button"
            onClick={handleStartEdit}
            className="p-2 rounded-md transition-colors text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
            title="แก้ไขข้อความ"
          >
            <MdEdit className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {/* Action buttons for user messages */}
      {message.role === 'user' && (
        <div className={`${message.role === 'user' ? 'mr-11' : 'ml-11'} mt-2 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className="p-2 rounded-md transition-colors text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
            title={isCopied ? "คัดลอกแล้ว!" : "คัดลอกข้อความ"}
          >
            <MdContentCopy className="h-5 w-5" />
          </button>
          
          {/* Edit button - for all user messages */}
          {onEditClick && (
            <button
              type="button"
              onClick={() => handleStartEdit()}
              className="p-2 rounded-md transition-colors text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
              title="แก้ไขข้อความ"
            >
              <MdEdit className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatBubble; 