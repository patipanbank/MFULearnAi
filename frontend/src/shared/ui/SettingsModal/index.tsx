import React, { useState, useEffect } from 'react';
import { FiX, FiDatabase, FiSettings, FiUser, FiKey, FiDownload, FiUpload, FiTrash2, FiPlus, FiEdit, FiCopy } from 'react-icons/fi';
import { useSettingsStore, useUIStore } from '../../stores';
import { api } from '../../lib/api';
import PreferencesModal from '../PreferencesModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Collection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'agent' | 'preferences' | 'advanced'>('knowledge');
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  
  // Local state for collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  
  const { 
    preferences,
    exportSettings, 
    importSettings,
    resetSettings
  } = useSettingsStore();
  
  const { addToast } = useUIStore();

  // Fetch collections using robust API utility
  const fetchCollections = async () => {
    setCollectionsLoading(true);
    try {
      const response = await api.get<Collection[]>('/collections');
      setCollections(response.data);
      console.log(`Successfully loaded ${response.data.length} collections`);
    } catch (error: any) {
      console.warn('Failed to load collections:', error);
      setCollections([]);
      
      const status = error.response?.status;
      
      // Show appropriate error messages
      if (status === 401) {
        addToast({
          type: 'warning',
          title: 'Authentication Required',
          message: 'Please log in to view collections'
        });
      } else if (error.code === 'ECONNABORTED' || status === undefined) { // Axios timeout or network error
        addToast({
          type: 'error',
          title: 'Connection Error',
          message: 'Network timeout. Please check your connection and try again.'
        });
      } else {
        addToast({
          type: 'error',
          title: 'Loading Error',
          message: `Unable to load collections. (Error ${status})`
        });
      }
    } finally {
      setCollectionsLoading(false);
    }
  };

  // Toggle collection selection
  const toggleCollection = (collectionId: string) => {
    setSelectedCollections(prev => 
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  // Load collections when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'knowledge') {
      fetchCollections();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'knowledge', label: 'Knowledge Base', icon: FiDatabase },
    { id: 'agent', label: 'AI Agents', icon: FiUser },
    { id: 'preferences', label: 'Preferences', icon: FiSettings },
    { id: 'advanced', label: 'Advanced', icon: FiKey }
  ] as const;

  const handleExportSettings = () => {
    try {
      const settingsData = exportSettings();
      const blob = new Blob([settingsData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dindin-ai-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addToast({
        type: 'success',
        title: 'Settings Exported',
        message: 'Your settings have been downloaded successfully'
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export settings'
      });
    }
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settingsData = e.target?.result as string;
        const success = importSettings(settingsData);
        
        if (success) {
          addToast({
            type: 'success',
            title: 'Settings Imported',
            message: 'Your settings have been imported successfully'
          });
        } else {
          addToast({
            type: 'error',
            title: 'Import Failed',
            message: 'Invalid settings file format'
          });
        }
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Import Failed',
          message: 'Failed to read settings file'
        });
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const handleResetSettings = async () => {
    if (confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
      try {
        await resetSettings();
        addToast({
          type: 'success',
          title: 'Settings Reset',
          message: 'All settings have been reset to default'
        });
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Reset Failed',
          message: 'Failed to reset settings'
        });
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-4xl w-full max-h-[90vh] overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-64 sidebar border-r border-border p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-primary">Settings</h2>
            <button
              onClick={onClose}
              className="btn-ghost p-1"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
          
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'btn-primary'
                      : 'btn-ghost'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-primary mb-2">Knowledge Base</h3>
                <p className="text-secondary">Select which knowledge bases to use for AI responses</p>
              </div>

              {collectionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-secondary">Loading collections...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">
                      Selected: {selectedCollections.length} of {collections.length}
                    </span>
                    <button
                      onClick={fetchCollections}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      Refresh Collections
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {collections.map((collection) => (
                      <div
                        key={collection.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedCollections.includes(collection.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'card card-hover'
                        }`}
                        onClick={() => toggleCollection(collection.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <FiDatabase className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-primary">{collection.name}</h4>
                            <p className="text-xs text-secondary mt-1">
                              By: {collection.createdBy} • {collection.permission}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {collections.length === 0 && !collectionsLoading && (
                    <div className="text-center py-8">
                      <FiDatabase className="h-12 w-12 mx-auto text-muted opacity-50" />
                      <p className="text-muted mt-2">No collections available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Agent Tab */}
          {activeTab === 'agent' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-primary mb-2">AI Agents</h3>
                <p className="text-secondary">Create and manage specialized AI assistants</p>
              </div>

              {/* Agent Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {/* Sample agents - replace with real data */}
                {[
                  { id: '1', name: 'Code Assistant', description: 'Helps with programming tasks', model: 'Claude 3.5', collections: ['docs'], isPublic: false },
                  { id: '2', name: 'Writing Helper', description: 'Assists with content creation', model: 'GPT-4', collections: ['writing'], isPublic: true }
                ].map((agent) => (
                  <div key={agent.id} className="card card-hover p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <FiUser className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-primary">{agent.name}</h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            agent.isPublic 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}>
                            {agent.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <button className="btn-ghost p-1 hover:!text-blue-600 hover:!bg-blue-50 dark:hover:!bg-blue-900/20">
                          <FiEdit className="h-3 w-3" />
                        </button>
                        <button className="btn-ghost p-1 hover:!text-green-600 hover:!bg-green-50 dark:hover:!bg-green-900/20">
                          <FiCopy className="h-3 w-3" />
                        </button>
                        <button className="btn-ghost p-1 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20">
                          <FiTrash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-secondary mb-3">{agent.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Model: {agent.model}</span>
                      <span>{agent.collections.length} collections</span>
                    </div>
                  </div>
                ))}
                
                {/* Create New Agent Card */}
                <div className="bg-tertiary border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-border-hover hover:bg-secondary transition-colors">
                  <div className="h-8 w-8 bg-secondary rounded-lg flex items-center justify-center mb-2">
                    <FiPlus className="h-4 w-4 text-muted" />
                  </div>
                  <span className="text-sm font-medium text-primary">Create Agent</span>
                  <span className="text-xs text-muted mt-1">Build a specialized assistant</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => window.open('/agent', '_blank')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Open Full Agent Manager →
                </button>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-primary mb-2">Preferences</h3>
                <p className="text-secondary">Customize your DINDIN AI experience</p>
              </div>
              <button
                onClick={() => setShowPreferencesModal(true)}
                className="w-full p-4 text-left card card-hover"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-primary">Open Preferences</h4>
                    <p className="text-sm text-secondary mt-1">Configure your settings and preferences</p>
                  </div>
                  <FiSettings className="h-5 w-5 text-muted" />
                </div>
              </button>
            </div>
          )}
          
          {/* Preferences Modal */}
          <PreferencesModal 
            isOpen={showPreferencesModal} 
            onClose={() => setShowPreferencesModal(false)} 
          />

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-primary mb-2">Advanced Settings</h3>
                <p className="text-secondary">Import, export, and reset your settings</p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-primary mb-4">Settings Management</h4>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleExportSettings}
                        className="btn-primary flex items-center space-x-2"
                      >
                        <FiDownload className="h-4 w-4" />
                        <span>Export Settings</span>
                      </button>
                      
                      <label className="btn-ghost flex items-center space-x-2 cursor-pointer">
                        <FiUpload className="h-4 w-4" />
                        <span>Import Settings</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportSettings}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <button
                      onClick={handleResetSettings}
                      className="flex items-center space-x-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <FiTrash2 className="h-4 w-4" />
                      <span>Reset All Settings</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-primary mb-4">Debug Information</h4>
                  <div className="bg-tertiary rounded-lg p-4 font-mono text-sm">
                    <div>Version: 1.0.0</div>
                    <div>Build: {new Date().toISOString().split('T')[0]}</div>
                    <div>Theme: {preferences.theme}</div>
                    <div>Collections: {selectedCollections.length} selected</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 