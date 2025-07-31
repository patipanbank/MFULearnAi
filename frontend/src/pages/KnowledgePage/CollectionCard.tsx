import React, { useState, useEffect } from 'react';
import { FiDatabase, FiEye, FiUpload, FiEdit, FiTrash2, FiUsers, FiLock, FiGlobe } from 'react-icons/fi';
import { api } from '../../shared/lib/api';

interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
  department?: string;
  modelId?: string;
}

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

  // Fetch document count for this collection
  useEffect(() => {
    const fetchDocumentCount = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ total: number }>(`/collections/${collection.id}/documents?limit=1&offset=0`);
        setDocumentCount(response.total || 0);
      } catch (error) {
        console.error('Error fetching document count:', error);
        setDocumentCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentCount();
  }, [collection.id]);



  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'PUBLIC':
        return <FiGlobe className="h-4 w-4 text-green-600" />;
      case 'DEPARTMENT':
        return <FiUsers className="h-4 w-4 text-blue-600" />;
      case 'PRIVATE':
        return <FiLock className="h-4 w-4 text-yellow-600" />;
      default:
        return <FiLock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case 'PUBLIC':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'DEPARTMENT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'PRIVATE':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
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
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FiDatabase className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-primary truncate ${compact ? 'text-base' : 'text-lg'}`}>
              {collection.name}
            </h3>
            <p className="text-sm text-muted truncate">Created by {collection.createdBy}</p>
          </div>
        </div>
        
        {showActions && !compact && (
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(collection);
              }}
              className="btn-ghost p-2"
              title="View Details"
            >
              <FiEye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpload(collection);
              }}
              className="btn-ghost p-2"
              title="Upload Documents"
            >
              <FiUpload className="h-4 w-4" />
            </button>
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(collection);
                }}
                className="btn-ghost p-2"
                title="Edit Collection"
              >
                <FiEdit className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(collection);
                }}
                className="btn-ghost p-2 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                title="Delete Collection"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Permission Badge */}
      <div className="flex items-center space-x-2 mb-4">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPermissionColor(collection.permission)}`}>
          {getPermissionIcon(collection.permission)}
          <span className="ml-1">{collection.permission}</span>
        </span>
        {collection.department && (
          <span className="text-xs text-muted bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {collection.department}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Documents:</span>
          <span className="text-primary font-medium">
            {loading ? '...' : documentCount}
          </span>
        </div>
        
        {!compact && (
          <div className="flex items-center justify-between">
            <span className="text-muted">Created:</span>
            <span className="text-primary">
              {formatDate(collection.createdAt)}
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!compact && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
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