import { Collection, CollectionPermission } from './types';

/**
 * Get relative time from a date string
 */
export const getRelativeTime = (dateString: string): string => {
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

/**
 * Validate collection name
 */
export const isValidCollectionName = (name: string): boolean => {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(name);
};

/**
 * Get validation error message for collection name
 */
export const getCollectionNameError = (name: string): string => {
  if (!name.trim()) {
    return 'Collection name is required';
  }
  if (name.length < 3) {
    return 'Collection name must be at least 3 characters';
  }
  if (name.length > 50) {
    return 'Collection name must be less than 50 characters';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return 'Collection name can only contain letters, numbers, dashes, and underscores';
  }
  return '';
};

/**
 * Get styling for collection permission badges
 */
export const getPermissionStyle = (permission?: CollectionPermission | string[] | undefined) => {
  if (Array.isArray(permission)) {
    return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
  }
  
  switch (permission) {
    case CollectionPermission.PRIVATE:
      return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
    case CollectionPermission.PUBLIC:
      return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

/**
 * Get readable label for collection permission
 */
export const getPermissionLabel = (permission?: CollectionPermission | string[] | undefined) => {
  if (Array.isArray(permission)) {
    return 'Shared';
  }
  
  switch (permission) {
    case CollectionPermission.PRIVATE:
      return 'Private';
    case CollectionPermission.PUBLIC:
      return 'Public';
    default:
      return 'Unknown';
  }
};

/**
 * Filter collections by user
 * @param collections List of collections to filter
 * @param userId User ID or name to filter by
 */
export const filterUserCollections = (
  collections: Collection[],
  userId?: string
): Collection[] => {
  if (!userId) return [];
  
  // Filter to only collections created by the user
  return collections.filter(collection => 
    collection.createdBy === userId
  );
};

// Format date to readable format
export const formatDate = (dateString: string): string => {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid date';
  }
};

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Generate a random ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Truncate string with ellipsis
export const truncateString = (str: string, maxLength: number): string => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  
  return str.substring(0, maxLength) + '...';
}; 