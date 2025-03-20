import React from 'react';
import { 
  AiOutlineFile, 
  AiOutlineFileText, 
  AiOutlineFilePdf, 
  AiOutlineFileExcel, 
  AiOutlineFilePpt, 
  AiOutlineFileWord 
} from 'react-icons/ai';

interface FileIconProps {
  filename: string;
  type?: string;
}

const FileIcon: React.FC<FileIconProps> = ({ filename, type }) => {
  // Get file type from filename extension or use provided type
  const fileType = type || filename.split('.').pop()?.toLowerCase() || '';
  
  if (fileType.includes('pdf')) return <AiOutlineFilePdf className="w-5 h-5 text-red-500" />;
  if (fileType.includes('word') || fileType.includes('doc')) return <AiOutlineFileWord className="w-5 h-5 text-blue-500" />;
  if (fileType.includes('excel') || fileType.includes('xls') || fileType.includes('csv')) return <AiOutlineFileExcel className="w-5 h-5 text-green-500" />;
  if (fileType.includes('powerpoint') || fileType.includes('ppt')) return <AiOutlineFilePpt className="w-5 h-5 text-orange-500" />;
  if (fileType.includes('text') || fileType.includes('txt')) return <AiOutlineFileText className="w-5 h-5 text-gray-500" />;
  return <AiOutlineFile className="w-5 h-5 text-gray-500" />;
};

export default FileIcon; 