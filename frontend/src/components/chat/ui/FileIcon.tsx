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
  type: string;
}

const FileIcon: React.FC<FileIconProps> = ({ type }) => {
  if (type.includes('pdf')) return <AiOutlineFilePdf className="w-5 h-5 text-red-500" />;
  if (type.includes('word') || type.includes('docx')) return <AiOutlineFileWord className="w-5 h-5 text-blue-500" />;
  if (type.includes('excel') || type.includes('xlsx') || type.includes('csv')) return <AiOutlineFileExcel className="w-5 h-5 text-green-500" />;
  if (type.includes('powerpoint') || type.includes('pptx')) return <AiOutlineFilePpt className="w-5 h-5 text-orange-500" />;
  if (type.includes('text')) return <AiOutlineFileText className="w-5 h-5 text-gray-500" />;
  return <AiOutlineFile className="w-5 h-5 text-gray-500" />;
};

export default FileIcon; 