import React, { useState, useEffect } from 'react';
import { MdClose, MdDownload, MdZoomIn, MdZoomOut } from 'react-icons/md';
import { MessageFile } from '../utils/types';
import FileIcon from './FileIcon';
import { formatFileSize } from '../utils/formatters';

interface FileViewerModalProps {
  file: MessageFile | null;
  isOpen: boolean;
  onClose: () => void;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({ file, isOpen, onClose }) => {
  const [zoom, setZoom] = useState(100);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (file && isOpen) {
      loadFileContent();
    }
  }, [file, isOpen]);

  const loadFileContent = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      // For text-based files, decode base64 to text
      if (isTextFile(file.mediaType)) {
        const decodedContent = atob(file.data);
        setFileContent(decodedContent);
      }
    } catch (error) {
      console.error('Error loading file content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isTextFile = (mediaType: string): boolean => {
    return mediaType.startsWith('text/') || 
           mediaType === 'application/json' ||
           mediaType === 'application/xml' ||
           mediaType.includes('csv');
  };

  const isImageFile = (mediaType: string): boolean => {
    return mediaType.startsWith('image/');
  };

  const isPDFFile = (mediaType: string): boolean => {
    return mediaType === 'application/pdf';
  };

  const handleDownload = () => {
    if (!file) return;

    try {
      const blob = new Blob([Uint8Array.from(atob(file.data), c => c.charCodeAt(0))], {
        type: file.mediaType
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleZoomIn = () => setZoom((prev: number) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev: number) => Math.max(prev - 25, 25));

  if (!isOpen || !file) return null;

  const renderFileViewer = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (isImageFile(file.mediaType)) {
      return (
        <div className="flex justify-center items-center max-h-[70vh] overflow-auto">
          <img
            src={`data:${file.mediaType};base64,${file.data}`}
            alt={file.name}
            style={{ zoom: `${zoom}%` }}
            className="max-w-full h-auto rounded-lg"
          />
        </div>
      );
    }

    if (isPDFFile(file.mediaType)) {
      return (
        <div className="h-[70vh]">
          <iframe
            src={`data:${file.mediaType};base64,${file.data}`}
            className="w-full h-full rounded-lg"
            title={file.name}
          />
        </div>
      );
    }

    if (isTextFile(file.mediaType)) {
      return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-[70vh] overflow-auto">
          <pre className="text-sm whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">
            {fileContent}
          </pre>
        </div>
      );
    }

    // For other file types, show file info and download option
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-16 h-16 flex items-center justify-center">
          <FileIcon fileName={file.name} type={file.mediaType} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{file.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{file.mediaType}</p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <MdDownload className="h-4 w-4" />
          Download File
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileIcon fileName={file.name} type={file.mediaType} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {file.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(file.size)} • {file.mediaType}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Zoom controls for images */}
            {isImageFile(file.mediaType) && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  disabled={zoom <= 25}
                >
                  <MdZoomOut className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400 min-w-12 text-center">
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  disabled={zoom >= 200}
                >
                  <MdZoomIn className="h-5 w-5" />
                </button>
              </>
            )}
            
            {/* Download button */}
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Download file"
            >
              <MdDownload className="h-5 w-5" />
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <MdClose className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-hidden">
          {renderFileViewer()}
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal; 