import React, { useRef, useEffect, FormEvent, ChangeEvent } from 'react';
import { FaCog, FaTrash } from 'react-icons/fa';
import { CollectionExtended, UploadedFile } from '../utils/types';
import { BaseModal } from './BaseModal';

interface CollectionModalProps {
  collection: CollectionExtended;
  onClose: () => void;
  uploadedFiles: UploadedFile[];
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFileUpload: (e: FormEvent) => void;
  uploadLoading: boolean;
  onShowSettings?: () => void;
  onDeleteFile: (file: UploadedFile) => void;
}

export const CollectionModal: React.FC<CollectionModalProps> = ({
  collection,
  onClose,
  uploadedFiles,
  onFileChange,
  onFileUpload,
  uploadLoading,
  onShowSettings,
  onDeleteFile,
}) => {
  // Add ref for click outside detection
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const settingsModal = document.querySelector('[data-modal="settings"]');
      // If settings modal is open, don't handle click outside for collection modal
      if (settingsModal) {
        return;
      }
      
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <BaseModal onClose={onClose} containerClasses="w-full md:w-2/3 lg:w-1/2 relative overflow-y-auto max-h-[80vh]">
      <div ref={modalRef} data-modal="collection" className="relative">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{collection.name}</h2>
              {onShowSettings && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowSettings();
                  }}
                  className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
                  text-gray-600 dark:text-gray-300 transition-all duration-200
                  border border-gray-200 dark:border-gray-700"
                  title="Collection Settings"
                >
                  <FaCog size={18} />
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage documents and settings for this collection
            </p>
          </div>
        </div>

        {/* File Upload Section */}
        <section className="mb-8 bg-gradient-to-br from-gray-50 to-gray-100 
        dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl p-6 
        border-2 border-dashed border-gray-300 dark:border-gray-600">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Upload Document
          </h3>
          <form onSubmit={onFileUpload} className="space-y-4">
            <div className="relative">
              <input
                type="file"
                onChange={onFileChange}
                className="block w-full text-gray-600 dark:text-gray-300
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                dark:file:bg-blue-900/30 dark:file:text-blue-400
                hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40
                file:cursor-pointer cursor-pointer
                focus:outline-none transition-colors duration-200"
                accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.json,.xml"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Supported formats: PDF, TXT, DOC, DOCX, XLS, XLSX, CSV, JSON, XML (Max 1MB)
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Please upload files without images.
              </p>
            </div>
            <button
              type="submit"
              disabled={uploadLoading}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium text-white
              transition-all duration-200 flex items-center justify-center space-x-2
              ${uploadLoading 
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 shadow-md hover:shadow-lg transform hover:scale-105'
              }`}
            >
              {uploadLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                  </svg>
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Files List Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Documents in Collection
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {uploadedFiles.length > 0 ? (
            <div className="space-y-3">
              {uploadedFiles.map((fileItem, index) => (
                <div 
                  key={index} 
                  className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm 
                  border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md 
                  transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                        {fileItem.filename}
                      </h4>
                      <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-4 text-sm">
                        <p className="text-gray-600 dark:text-gray-300">
                          {fileItem.uploadedBy}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                          {new Date(fileItem.timestamp).toLocaleString()}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                          {fileItem.ids.length} chunks
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteFile(fileItem)}
                      className="ml-4 p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 
                      dark:hover:text-red-400 transition-colors duration-200 rounded-lg 
                      hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Delete Document"
                    >
                      <FaTrash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 
            dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl border-2 border-dashed 
            border-gray-300 dark:border-gray-600">
              <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <p className="mt-4 text-base font-medium text-gray-600 dark:text-gray-400">
                No documents uploaded yet
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Upload a document to get started with your collection
              </p>
            </div>
          )}
        </section>
      </div>
    </BaseModal>
  );
} 