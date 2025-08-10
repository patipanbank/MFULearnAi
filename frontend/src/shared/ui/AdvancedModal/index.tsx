import React, { useState, useRef } from 'react';
import { FiX, FiDownload, FiUpload, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { useSettingsStore, useUIStore } from '../../stores';
import useLayoutStore from '../../stores/layoutStore';

interface AdvancedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdvancedModal: React.FC<AdvancedModalProps> = ({ isOpen, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { exportSettings, importSettings, resetSettings } = useSettingsStore();
  const { addToast } = useUIStore();
  const { isMobile } = useLayoutStore();
  
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);
  
  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = exportSettings();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dindin-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addToast({
        type: 'success',
        title: 'Export Complete',
        message: 'Your data has been exported successfully'
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export data'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as string;
        const success = importSettings(data);
        
        if (success) {
          addToast({
            type: 'success',
            title: 'Import Complete',
            message: 'Your data has been imported successfully'
          });
          onClose();
        } else {
          addToast({
            type: 'error',
            title: 'Import Failed',
            message: 'Invalid backup file format'
          });
        }
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Import Failed',
          message: 'Failed to read backup file'
        });
      } finally {
        setIsImporting(false);
      }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const handleResetAll = async () => {
    if (confirm('Are you sure you want to reset all data? This action cannot be undone and will log you out.')) {
      try {
        await resetSettings();
        addToast({
          type: 'success',
          title: 'Data Reset',
          message: 'All data has been reset to defaults'
        });
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Reset Failed',
          message: 'Failed to reset data'
        });
      }
    }
  };

  const handleClearCache = () => {
    if (confirm('Clear all cached data? This will log you out.')) {
      localStorage.clear();
      sessionStorage.clear();
      addToast({
        type: 'info',
        title: 'Cache Cleared',
        message: 'Page will reload...'
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="modal-overlay"
      onClick={handleBackdropClick}
    >
      <div className={`modal-content max-w-2xl w-full max-h-[90vh] overflow-hidden ${isMobile ? 'animate-slide-up-from-bottom' : ''}`}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-primary">Advanced Settings</h2>
              <p className="text-sm text-secondary mt-1">Import, export, and manage your data</p>
            </div>
            <button
              onClick={onClose}
              className="btn-ghost p-2"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
          {/* Data Management */}
          <div>
            <h3 className="text-lg font-medium text-primary mb-4">Data Management</h3>
            <div className="space-y-4">
              {/* Export Data */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-primary">Export Data</h4>
                    <p className="text-sm text-muted">Download all your settings and preferences as a backup file</p>
                  </div>
                  <FiDownload className="h-5 w-5 text-muted" />
                </div>
                <button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <FiDownload className="h-4 w-4" />
                      <span>Export Data</span>
                    </>
                  )}
                </button>
              </div>

              {/* Import Data */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-primary">Import Data</h4>
                    <p className="text-sm text-muted">Restore settings from a backup file</p>
                  </div>
                  <FiUpload className="h-5 w-5 text-muted" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <FiUpload className="h-4 w-4" />
                      <span>Import Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* System Actions */}
          <div>
            <h3 className="text-lg font-medium text-primary mb-4">System Actions</h3>
            <div className="space-y-3">
              <button
                onClick={handleClearCache}
                className="w-full flex items-center justify-between px-4 py-3 border border-yellow-200 dark:border-yellow-600 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <FiRefreshCw className="h-5 w-5 text-yellow-600" />
                  <div className="text-left">
                    <div className="font-medium text-primary">Clear Cache</div>
                    <div className="text-sm text-muted">Clear all cached data (requires logout)</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={handleResetAll}
                className="w-full flex items-center justify-between px-4 py-3 border border-red-200 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <FiTrash2 className="h-5 w-5 text-red-600" />
                  <div className="text-left">
                    <div className="font-medium text-primary">Reset All Data</div>
                    <div className="text-sm text-muted">Reset all settings to default values</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Debug Information */}
          <div>
            <h3 className="text-lg font-medium text-primary mb-4">Debug Information</h3>
            <div className="bg-tertiary rounded-lg p-4">
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-secondary">Version:</span>
                  <span className="text-primary">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Build Date:</span>
                  <span className="text-primary">{new Date().toISOString().split('T')[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Environment:</span>
                  <span className="text-primary">{import.meta.env.MODE || 'development'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Browser:</span>
                  <span className="text-primary">{navigator.userAgent.split(' ')[0] || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-border bg-tertiary">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="btn-ghost"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedModal; 