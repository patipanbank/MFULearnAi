import React, { useState, useEffect } from 'react';
import { FiDatabase, FiEye, FiUpload, FiEdit, FiTrash2, FiUsers, FiLock, FiGlobe, FiCalendar, FiFileText, FiMoreVertical } from 'react-icons/fi';
import { api } from '../../shared/lib/api';
import type { Collection } from '../../shared/types';

interface CollectionCardProps {
  collection: Collection;
  onView: (collection: Collection) => void;
  onUpload: (collection: Collection) => void;
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
  showActions?: boolean;
  compact?: boolean;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  onView,
  onUpload,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}) => {
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Fetch document count for this collection
  useEffect(() => {
    const fetchDocumentCount = async () => {
      try {
        setLoading(true);
        const collectionId = collection._id;
        if (!collectionId) {
          console.error('Collection ID is undefined');
          setDocumentCount(0);
          return;
        }
        const response = await api.get<{ total: number }>(`/collections/${collectionId}/documents?limit=1&offset=0`);
        setDocumentCount(response.total || 0);
      } catch (error) {
        console.error('Error fetching document count:', error);
        setDocumentCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentCount();
  }, [collection._id]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) {
        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'PUBLIC':
        return <FiGlobe className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'DEPARTMENT':
        return <FiUsers className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'PRIVATE':
        return <FiLock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <FiLock className="h-4 w-4 text-muted" />;
    }
  };

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case 'PUBLIC':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'DEPARTMENT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'PRIVATE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-secondary text-secondary';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`card card-hover ${compact ? 'p-4' : 'p-6'} relative group`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
            <FiDatabase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-primary truncate ${compact ? 'text-base' : 'text-lg'}`}>
              {collection.name}
            </h3>
            <p className="text-sm text-secondary truncate">Created by {collection.createdBy}</p>
          </div>
        </div>
        
        {showActions && !compact && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="btn-ghost p-2 opacity-0 group-hover:opacity-100 transition-all duration-200"
            >
              <FiMoreVertical className="h-4 w-4" />
            </button>
            
            {showMenu && (
              <div className="dropdown-menu absolute right-0 top-full mt-1 w-48">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onView(collection);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-secondary flex items-center space-x-2"
                  >
                    <FiEye className="h-4 w-4" />
                    <span>View Details</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onUpload(collection);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-secondary flex items-center space-x-2"
                  >
                    <FiUpload className="h-4 w-4" />
                    <span>Upload Documents</span>
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(collection);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-secondary flex items-center space-x-2"
                    >
                      <FiEdit className="h-4 w-4" />
                      <span>Edit Collection</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(collection);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                    >
                      <FiTrash2 className="h-4 w-4" />
                      <span>Delete Collection</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permission Badge */}
      <div className="flex items-center space-x-2 mb-4">
        {getPermissionIcon(collection.permission)}
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPermissionColor(collection.permission)}`}>
          {collection.permission}
        </span>
        {collection.department && (
          <span className="text-xs text-secondary bg-secondary px-2 py-1 rounded">
            {collection.department}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FiFileText className="h-4 w-4 text-muted" />
            <span className="text-sm text-secondary">Documents</span>
          </div>
          <span className="text-sm font-medium text-primary">
            {loading ? '...' : documentCount}
          </span>
        </div>
        
        {!compact && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FiCalendar className="h-4 w-4 text-muted" />
              <span className="text-sm text-secondary">Created</span>
            </div>
            <span className="text-sm text-primary">
              {formatDate(collection.createdAt)}
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!compact && (
        <div className="flex items-center justify-between pt-4 border-t border-secondary">
          <button
            onClick={() => onView(collection)}
            className="btn-secondary text-sm flex items-center space-x-2"
          >
            <FiEye className="h-4 w-4" />
            <span>View</span>
          </button>
          
          <button
            onClick={() => onUpload(collection)}
            className="btn-primary text-sm flex items-center space-x-2"
          >
            <FiUpload className="h-4 w-4" />
            <span>Upload</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CollectionCard; 