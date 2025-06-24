import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiMoon, FiSun, FiMonitor, FiMessageSquare } from 'react-icons/fi';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import useLayoutStore from '../../stores/layoutStore';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const { 
    preferences, 
    setPreferences, 
    isSaving, 
    saveSettings,
    applyTheme 
  } = useSettingsStore();
  
  const { addToast } = useUIStore();
  const { isMobile } = useLayoutStore();
  
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when preferences change
  useEffect(() => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  }, [preferences]);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(localPreferences) !== JSON.stringify(preferences);
    setHasChanges(changed);
  }, [localPreferences, preferences]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    console.log('PreferencesModal: Changing theme to', theme);
    const newPreferences = { ...localPreferences, theme };
    setLocalPreferences(newPreferences);
    
    // Apply theme immediately for preview
    applyTheme(theme);
    
    // Debug: Check if dark class is applied
    setTimeout(() => {
      const isDark = document.documentElement.classList.contains('dark');
      console.log('PreferencesModal: Dark class applied?', isDark);
      console.log('PreferencesModal: HTML classes:', document.documentElement.className);
    }, 100);
  };

  const handleSave = async () => {
    try {
      setPreferences(localPreferences);
      await saveSettings();
      addToast({
        type: 'success',
        title: 'Preferences Saved',
        message: 'Your preferences have been updated successfully'
      });
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save preferences'
      });
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        // Revert theme changes
        applyTheme(preferences.theme);
        setLocalPreferences(preferences);
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const themes = [
    { value: 'light', label: 'Light', icon: FiSun, description: 'Light theme' },
    { value: 'dark', label: 'Dark', icon: FiMoon, description: 'Dark theme' },
    { value: 'auto', label: 'System', icon: FiMonitor, description: 'Follow system preference' }
  ];

  return (
    <div 
      className="modal-overlay"
      onClick={handleBackdropClick}
    >
      <div className={`modal-content max-w-2xl w-full max-h-[90vh] overflow-hidden ${
        isMobile ? 'animate-slide-up-from-bottom' : ''
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-primary">Preferences</h2>
            <p className="text-sm text-secondary mt-1">Customize your DINDIN AI experience</p>
          </div>
          <button
            onClick={handleCancel}
            className="btn-ghost p-2"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {/* Theme Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary flex items-center space-x-2">
              <FiSun className="h-5 w-5" />
              <span>Appearance</span>
            </h3>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-primary mb-3">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {themes.map(({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    onClick={() => handleThemeChange(value as any)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      localPreferences.theme === value
                        ? 'btn-primary'
                        : 'card card-hover'
                    }`}
                  >
                    <Icon className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-sm font-medium">{label}</div>
                    <span className="text-xs text-muted">{description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* General Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary flex items-center space-x-2">
              <FiMessageSquare className="h-5 w-5" />
              <span>Chat Settings</span>
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-tertiary rounded-lg">
                <div>
                  <span className="text-sm font-medium text-primary">Auto-save chats</span>
                  <p className="text-sm text-secondary">Automatically save chat sessions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPreferences.autoSave}
                    onChange={(e) => setLocalPreferences({ ...localPreferences, autoSave: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-tertiary rounded-lg">
                <div>
                  <span className="text-sm font-medium text-primary">Notifications</span>
                  <p className="text-sm text-secondary">Show system notifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPreferences.notifications}
                    onChange={(e) => setLocalPreferences({ ...localPreferences, notifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-tertiary">
          <div className="text-sm text-muted">
            {hasChanges && (
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Unsaved changes</span>
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FiSave className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesModal; 