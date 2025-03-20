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
}

const FileIcon: React.FC<FileIconProps> = ({ filename }) => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  if (extension === 'pdf') return <AiOutlineFilePdf className="w-5 h-5 text-red-500" />;
  if (['doc', 'docx'].includes(extension)) return <AiOutlineFileWord className="w-5 h-5 text-blue-500" />;
  if (['xls', 'xlsx', 'csv'].includes(extension)) return <AiOutlineFileExcel className="w-5 h-5 text-green-500" />;
  if (['ppt', 'pptx'].includes(extension)) return <AiOutlineFilePpt className="w-5 h-5 text-orange-500" />;
  if (['txt', 'md'].includes(extension)) return <AiOutlineFileText className="w-5 h-5 text-gray-500" />;
  return <AiOutlineFile className="w-5 h-5 text-gray-500" />;
};

export default FileIcon; 