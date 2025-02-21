import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent, useRef } from 'react';
import { config } from '../../config/config';
import { FaPlus, FaTimes, FaCog, FaEllipsisH, FaTrash } from 'react-icons/fa';

// ----------------------
// Type Definitions
// ----------------------
interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission?: string;
}

interface UserInfo {
  username: string;
  role: 'USER' | 'STAFF' | 'ADMIN';
}

interface UploadedFile {
  filename: string;
  uploadedBy: string;
  timestamp: string;
  ids: string[];
}

interface MongoCollection {
  _id: string;
  name: string;
  createdBy?: string;
  created?: string;
  permission?: string;
}

interface MongoFile {
  filename: string;
  uploadedBy?: string;
  timestamp?: string;
  ids?: string[];
}

// ----------------------
// Utility Functions
// ----------------------
const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffSeconds = (now.getTime() - date.getTime()) / 1000;
  if (diffSeconds < 60) return 'Updated just now';
  const diffMinutes = diffSeconds / 60;
  if (diffMinutes < 60) return `Updated ${Math.floor(diffMinutes)} minutes ago`;
  const diffHours = diffMinutes / 60;
  if (diffHours < 24) return `Updated ${Math.floor(diffHours)} hours ago`;
  const diffDays = diffHours / 24;
  return `Updated ${Math.floor(diffDays)} days ago`;
};

// ----------------------
// Reusable Modal Component
// ----------------------
interface BaseModalProps {
  onClose: () => void;
  containerClasses?: string;
  children: React.ReactNode;
}

const BaseModal: React.FC<BaseModalProps> = ({
  onClose,
  containerClasses = '',
  children,
}) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div className={`relative bg-white dark:bg-gray-800 rounded p-6 ${containerClasses}`}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
        title="Close"
      >
        <FaTimes size={20} />
      </button>
      {children}
    </div>
  </div>
);

// ----------------------
// Dashboard Header Component
// ----------------------
interface DashboardHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewCollectionToggle: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewCollectionToggle,
}) => (
  <header className="mb-8">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Training Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your training collections and documents
        </p>
      </div>
      <button
        onClick={onNewCollectionToggle}
        className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 
        hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 
        dark:hover:from-blue-600 dark:hover:to-blue-700 text-white rounded-lg 
        transition-all duration-200 space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
      >
        <FaPlus size={16} />
        <span className="font-medium">New Collection</span>
      </button>
    </div>
    <div className="relative">
      <input
        type="text"
        placeholder="Search collections..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 
        bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
        placeholder-gray-500 dark:placeholder-gray-400
        focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
        transition-all duration-200 shadow-sm"
      />
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
    </div>
  </header>
);

// ----------------------
// New Collection Modal Component
// ----------------------
interface NewCollectionModalProps {
  newCollectionName: string;
  newCollectionPermission: string;
  onNameChange: (value: string) => void;
  onPermissionChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

const NewCollectionModal: React.FC<NewCollectionModalProps> = ({
  newCollectionName,
  newCollectionPermission,
  onNameChange,
  onPermissionChange,
  onSubmit,
  onCancel,
}) => {
  // Add ref for click outside detection
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  return (
    <BaseModal onClose={onCancel} containerClasses="w-[28rem]">
      <div ref={modalRef} className="relative">
        <div className="mb-6">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Create New Collection
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create a new collection to organize your training documents.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Name
            </label>
            <input
              type="text"
              placeholder="Enter collection name"
              value={newCollectionName}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
              placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Access Permission
            </label>
            <select
              value={newCollectionPermission}
              onChange={(e) => onPermissionChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="PRIVATE">Private - Only you can access</option>
              <option value="STAFF_ONLY">Staff Only - All staff members can access</option>
              <option value="PUBLIC">Public - Everyone can access</option>
            </select>
          </div>
          <div className="flex flex-col space-y-2 pt-4">
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 
              dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium 
              transform transition-all duration-200"
            >
              Create Collection
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
              transform transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </BaseModal>
  );
};

// ----------------------
// Collection Card Component
// ----------------------
interface CollectionCardProps {
  collection: Collection;
  onSelect: () => void;
  activeDropdown: boolean;
  onDropdownToggle: () => void;
  onSettings: () => void;
  onDelete: () => void;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  onSelect,
  activeDropdown,
  onDropdownToggle,
  onSettings,
  onDelete,
}) => {
  const getPermissionStyle = (permission?: string) => {
    switch (permission) {
      case 'PRIVATE':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'STAFF_ONLY':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      case 'PUBLIC':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getPermissionLabel = (permission?: string) => {
    switch (permission) {
      case 'PRIVATE':
        return 'Private';
      case 'STAFF_ONLY':
        return 'Staff Only';
      case 'PUBLIC':
        return 'Public';
      default:
        return 'Unknown';
    }
  };

  return (
    <div
      className="group relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm 
      hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 
      dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600
      transform hover:scale-[1.02]"
      onClick={onSelect}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDropdownToggle();
        }}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 
        dark:text-gray-500 dark:hover:text-gray-300 rounded-full
        hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
        title="Options"
      >
        <FaEllipsisH size={16} />
      </button>
      {activeDropdown && (
        <div className="absolute top-14 right-4 bg-white dark:bg-gray-700 rounded-lg 
        shadow-xl border border-gray-200 dark:border-gray-600 overflow-hidden z-20
        backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSettings();
            }}
            className="flex items-center w-full px-4 py-2.5 text-gray-700 dark:text-gray-200 
            hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            <FaCog className="mr-2" size={14} />
            <span>Settings</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex items-center w-full px-4 py-2.5 text-red-600 dark:text-red-400 
            hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            <FaTrash className="mr-2" size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
            {collection.name}
          </h2>
        </div>
        <span className={`absolute bottom-4 right-4 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPermissionStyle(collection.permission)}`}>{getPermissionLabel(collection.permission)}</span>
        <div className="mt-auto space-y-1">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {collection.createdBy}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {getRelativeTime(collection.created)}
          </p>
        </div>
      </div>
    </div>
  );
};

// ----------------------
// Collection Modal (File Management)
// ----------------------
interface CollectionModalProps {
  collection: Collection;
  onClose: () => void;
  uploadedFiles: UploadedFile[];
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFileUpload: (e: FormEvent) => void;
  uploadLoading: boolean;
  onShowSettings: () => void;
  onDeleteFile: (file: UploadedFile) => void;
  isFilesLoading: boolean;
}

const CollectionModal: React.FC<CollectionModalProps> = ({
  collection,
  onClose,
  uploadedFiles,
  onFileChange,
  onFileUpload,
  uploadLoading,
  onShowSettings,
  onDeleteFile,
  isFilesLoading,
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
              <button
                onClick={onShowSettings}
                className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
                text-gray-600 dark:text-gray-300 transition-all duration-200
                border border-gray-200 dark:border-gray-700"
                title="Collection Settings"
              >
                <FaCog size={18} />
              </button>
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
                accept=".pdf,.txt,.doc,.docx,.xls,.xlsx"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Supported formats: PDF, TXT, DOC, DOCX, XLS, XLSX (Max 100MB)
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
          {isFilesLoading ? (
            <div className="text-center py-12">Loading files...</div>
          ) : (
            <>
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
            </>
          )}
        </section>
      </div>
    </BaseModal>
  );
};

// ----------------------
// Settings Modal Component
// ----------------------
interface SettingsModalProps {
  updatedCollectionName: string;
  updatedCollectionPermission: string;
  onNameChange: (value: string) => void;
  onPermissionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  updatedCollectionName,
  updatedCollectionPermission,
  onNameChange,
  onPermissionChange,
  onClose,
  onSubmit,
}) => {
  // Add ref for click outside detection
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <BaseModal onClose={onClose} containerClasses="w-96">
      <div ref={modalRef} data-modal="settings" className="relative">
        <div className="mb-6">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Collection Settings
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Update your collection settings and permissions.
          </p>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSubmit(e);
        }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Name
            </label>
            <input
              type="text"
              value={updatedCollectionName}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
              placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Access Permission
            </label>
            <select
              value={updatedCollectionPermission}
              onChange={(e) => onPermissionChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="PRIVATE">Private - Only you can access</option>
              <option value="STAFF_ONLY">Staff Only - All staff members can access</option>
              <option value="PUBLIC">Public - Everyone can access</option>
            </select>
          </div>
          <div className="flex flex-col space-y-2 pt-4">
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 
              dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium 
              transform transition-all duration-200"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
              transform transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </BaseModal>
  );
};

// ----------------------
// Main Dashboard Component
// ----------------------
const TrainingDashboard: React.FC = () => {
  // Dashboard state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilesLoading, setIsFilesLoading] = useState<boolean>(false);
  
  const [showNewCollectionModal, setShowNewCollectionModal] = useState<boolean>(false);
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [newCollectionPermission, setNewCollectionPermission] = useState<string>('PRIVATE');

  // Selected collection and dropdown state
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // File upload and management state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);

  // Settings modal state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [updatedCollectionName, setUpdatedCollectionName] = useState<string>('');
  const [updatedCollectionPermission, setUpdatedCollectionPermission] = useState<string>('PRIVATE');

  // Loading state for collections
  const [isCollectionsLoading, setIsCollectionsLoading] = useState<boolean>(false);

  // Add user info state
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const authToken = localStorage.getItem('auth_token');

  // ----------------------
  // API Calls
  // ----------------------
  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch user info');
      const data = await response.json();
      setUserInfo(data);
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }, [authToken]);

  const fetchCollections = useCallback(async () => {
    if (!userInfo) return;
    
    setIsCollectionsLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch collections');
      }

      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from server');
      }

      const collectionsWithDate: Collection[] = data
        .filter((collection: MongoCollection) => {
          if (!collection._id || !collection.name) return false;
          
          // Filter based on permissions
          switch (collection.permission) {
            case 'PUBLIC':
              return true;
            case 'STAFF_ONLY':
              return userInfo.role === 'STAFF' || userInfo.role === 'ADMIN';
            case 'PRIVATE':
              return collection.createdBy === userInfo.username || userInfo.role === 'ADMIN';
            default:
              return false;
          }
        })
        .map((collection: MongoCollection): Collection => ({
          id: collection._id.toString(),
          name: collection.name,
          createdBy: collection.createdBy || 'Unknown',
          created: collection.created || new Date().toISOString(),
          permission: collection.permission || 'PRIVATE',
        }));

      setCollections(collectionsWithDate);
    } catch (error) {
      console.error('Error fetching collections:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch collections');
    } finally {
      setIsCollectionsLoading(false);
    }
  }, [authToken, userInfo]);

  const fetchUploadedFiles = useCallback(async (collectionName: string) => {
    try {
      setIsFilesLoading(true);
      const response = await fetch(
        `${config.apiUrl}/api/training/documents?collectionName=${encodeURIComponent(collectionName)}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch files');
      }

      // Normalize the data structure
      let normalizedFiles: MongoFile[] = [];

      if (data.documents && Array.isArray(data.documents)) {
        normalizedFiles = data.documents;
      } else if (data.files && Array.isArray(data.files)) {
        normalizedFiles = data.files;
      } else if (Array.isArray(data)) {
        normalizedFiles = data;
      }

      // Validate and transform each file
      const validFiles: UploadedFile[] = normalizedFiles
        .filter((file: MongoFile) => file.filename && file.ids)
        .map((file: MongoFile): UploadedFile => ({
          filename: file.filename,
          uploadedBy: file.uploadedBy || 'Unknown',
          timestamp: file.timestamp || new Date().toISOString(),
          ids: Array.isArray(file.ids) ? file.ids : [],
        }));

      setUploadedFiles(validFiles);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch files');
    } finally {
      setIsFilesLoading(false);
    }
  }, [authToken]);

  // ----------------------
  // Effects
  // ----------------------
  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  useEffect(() => {
    if (userInfo) {
      fetchCollections();
    }
  }, [fetchCollections, userInfo]);

  useEffect(() => {
    if (selectedCollection) {
      setUpdatedCollectionName(selectedCollection.name);
      setUpdatedCollectionPermission(selectedCollection.permission || 'PRIVATE');
      fetchUploadedFiles(selectedCollection.name);
    }
  }, [selectedCollection, fetchUploadedFiles]);

  // Update settings handler with real-time sync
  const handleUpdateSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCollection) return;

    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections/${selectedCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: updatedCollectionName,
          permission: updatedCollectionPermission,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to update collection');
      }

      // Handle possible 204 No Content responses
      let updatedCollection;
      if (response.status === 204) {
        // If no content returned, use the updated values directly, and keep the collection id
        updatedCollection = { id: selectedCollection.id, name: updatedCollectionName, permission: updatedCollectionPermission };
      } else {
        updatedCollection = await response.json();
      }

      // Close the settings modal before updating state
      setShowSettings(false);

      // Update the collections list with new data
      setCollections(prevCollections =>
        prevCollections.map(col =>
          col.id === selectedCollection.id
            ? {
                ...col,
                name: updatedCollection.name,
                permission: updatedCollection.permission,
                // Preserve other fields
                created: col.created,
                createdBy: col.createdBy,
              }
            : col
        )
      );

      // Update the selected collection if it's currently open
      setSelectedCollection(prev =>
        prev?.id === selectedCollection.id
          ? {
              ...prev,
              name: updatedCollection.name,
              permission: updatedCollection.permission,
            }
          : prev
      );

      // Refresh the collections list from the API to ensure consistency
      try {
        await fetchCollections();
      } catch (err) {
        console.error('Error refreshing collections:', err);
      }

      // Refresh uploaded files if the collection name has changed
      if (updatedCollection.name !== selectedCollection.name) {
        await fetchUploadedFiles(updatedCollection.name);
      }

    } catch (error) {
      console.error('Error updating collection:', error);
      alert(error instanceof Error ? error.message : 'Failed to update collection. Please try again.');
    }
  };

  // Add real-time update effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateCollectionData = async () => {
      if (selectedCollection) {
        try {
          const response = await fetch(
            `${config.apiUrl}/api/training/collections/${selectedCollection.id}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
              },
            }
          );

          if (response.status === 404) {
            // Collection no longer exists - close the view and refresh collections
            setSelectedCollection(null);
            setShowSettings(false);
            fetchCollections();
            return;
          }

          if (!response.ok) {
            throw new Error('Failed to fetch collection update');
          }

          const updatedData = await response.json();

          // Update collection in the list
          setCollections(prevCollections =>
            prevCollections.map(col =>
              col.id === selectedCollection.id
                ? {
                    ...col,
                    ...updatedData,
                    // Preserve fields that might not be returned by the API
                    created: col.created,
                    createdBy: col.createdBy,
                  }
                : col
            )
          );

          // Update selected collection if it's open
          setSelectedCollection(prev =>
            prev?.id === selectedCollection.id
              ? {
                  ...prev,
                  ...updatedData,
                }
              : prev
          );

          // Refresh files if collection is selected
          await fetchUploadedFiles(updatedData.name);
        } catch (error) {
          console.error('Error in real-time update:', error);
          // If there's any other error, we'll keep the UI state as is
          // and let the next polling interval try again
        }
      }
    };

    // Set up polling interval for real-time updates
    if (selectedCollection) {
      intervalId = setInterval(updateCollectionData, 5000); // Poll every 5 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [selectedCollection, authToken, fetchUploadedFiles]);

  // Modify the collection selection handler
  const handleCollectionSelect = async (collection: Collection) => {
    setSelectedCollection(collection);
    try {
      // Fetch fresh data when selecting a collection
      const response = await fetch(
        `${config.apiUrl}/api/training/collections/${collection.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch collection details');
      }

      const freshData = await response.json();

      // Update collection in the list
      setCollections(prevCollections =>
        prevCollections.map(col =>
          col.id === collection.id
            ? {
                ...col,
                ...freshData,
                // Preserve fields that might not be returned by the API
                created: col.created,
                createdBy: col.createdBy,
              }
            : col
        )
      );

      // Update selected collection
      setSelectedCollection(prev =>
        prev?.id === collection.id
          ? {
              ...prev,
              ...freshData,
            }
          : prev
      );

      // Fetch associated files
      await fetchUploadedFiles(freshData.name);
    } catch (error) {
      console.error('Error fetching collection details:', error);
    }
  };

  // ----------------------
  // Event Handlers
  // ----------------------
  const handleCreateCollection = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) {
      alert('Please enter a collection name');
      return;
    }
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newCollectionName,
          permission: newCollectionPermission,
        }),
      });
      if (!response.ok) throw new Error('Failed to create collection');
      await fetchCollections();
      setNewCollectionName('');
      setShowNewCollectionModal(false);
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Error creating collection');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !selectedCollection) {
      alert('Please choose a file.');
      return;
    }
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('modelId', 'default');
      formData.append('collectionName', selectedCollection.name);

      const response = await fetch(`${config.apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });
      if (response.ok) {
        alert('File uploaded successfully');
        setFile(null);
        fetchUploadedFiles(selectedCollection.name);
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteCollection = async (collection: Collection) => {
    if (!window.confirm(`Are you sure you want to delete collection "${collection.name}"?`)) return;
    try {
      const response = await fetch(`${config.apiUrl}/api/training/collections/${collection.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete collection');
      alert('Collection deleted successfully');
      if (selectedCollection && selectedCollection.id === collection.id) {
        setSelectedCollection(null);
      }
      fetchCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      alert('Error deleting collection');
    }
  };

  const handleDeleteFile = async (fileToDelete: UploadedFile) => {
    if (!selectedCollection) return;
    if (!window.confirm(`Are you sure you want to delete the file ${fileToDelete.filename}?`)) return;
    
    // Delete each chunk for this file
    for (const chunkId of fileToDelete.ids) {
      try {
        await fetch(`${config.apiUrl}/api/training/documents/${chunkId}?collectionName=${encodeURIComponent(selectedCollection.name)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
      } catch (error) {
        console.error(`Error deleting chunk ${chunkId}:`, error);
      }
    }
    // Refresh the file list after deletion
    fetchUploadedFiles(selectedCollection.name);
  };

  const filteredCollections = collections.filter((collection) =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ----------------------
  // Render
  // ----------------------
  return (
    <div className="container mx-auto p-4 font-sans relative">
      <DashboardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewCollectionToggle={() => setShowNewCollectionModal(true)}
      />

      {isCollectionsLoading ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-300">Loading collections...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onSelect={() => handleCollectionSelect(collection)}
              activeDropdown={activeDropdownId === collection.id}
              onDropdownToggle={() =>
                setActiveDropdownId(activeDropdownId === collection.id ? null : collection.id)
              }
              onSettings={() => {
                setSelectedCollection(collection);
                setShowSettings(true);
                setActiveDropdownId(null);
              }}
              onDelete={() => {
                setActiveDropdownId(null);
                handleDeleteCollection(collection);
              }}
            />
          ))}
        </div>
      )}

      {selectedCollection && (
        <CollectionModal
          collection={selectedCollection}
          onClose={() => setSelectedCollection(null)}
          uploadedFiles={uploadedFiles}
          onFileChange={handleFileChange}
          onFileUpload={handleFileUpload}
          uploadLoading={uploadLoading}
          onShowSettings={() => setShowSettings(true)}
          onDeleteFile={handleDeleteFile}
          isFilesLoading={isFilesLoading}
        />
      )}

      {showSettings && selectedCollection && (
        <SettingsModal
          updatedCollectionName={updatedCollectionName}
          updatedCollectionPermission={updatedCollectionPermission}
          onNameChange={setUpdatedCollectionName}
          onPermissionChange={setUpdatedCollectionPermission}
          onClose={() => setShowSettings(false)}
          onSubmit={handleUpdateSettings}
        />
      )}

      {showNewCollectionModal && (
        <NewCollectionModal
          newCollectionName={newCollectionName}
          newCollectionPermission={newCollectionPermission}
          onNameChange={setNewCollectionName}
          onPermissionChange={setNewCollectionPermission}
          onSubmit={handleCreateCollection}
          onCancel={() => {
            setShowNewCollectionModal(false);
            setNewCollectionName('');
          }}
        />
      )}
    </div>
  );
};

export default TrainingDashboard;
