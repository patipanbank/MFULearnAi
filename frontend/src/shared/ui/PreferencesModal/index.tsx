import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiMoon, FiSun, FiMessageSquare } from 'react-icons/fi';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';

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

  const handleThemeChange = (theme: 'light' | 'dark') => {
    const newPreferences = { ...localPreferences, theme };
    setLocalPreferences(newPreferences);
    applyTheme(theme);
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
    { value: 'dark', label: 'Dark', icon: FiMoon, description: 'Dark theme' }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center md:p-4"
      onClick={handleBackdropClick}
    >
      <div className={cn(
        "relative w-full bg-primary flex flex-col max-h-[100vh] md:max-h-[90vh] md:w-auto md:min-w-[500px] md:max-w-2xl md:rounded-2xl overflow-hidden",
        "animate-in fade-in duration-200",
        "md:animate-in md:slide-in-from-bottom-2 md:duration-200"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
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

        {/* Content - Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Theme Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary flex items-center space-x-2">
              <FiSun className="h-5 w-5" />
              <span>Appearance</span>
            </h3>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-primary mb-3">Theme</label>
              <div className="grid grid-cols-2 gap-3">
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
            
            <div className="space-y-4">
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

        {/* Footer - Fixed at Bottom */}
        <div className="sticky bottom-0 left-0 right-0 flex items-center justify-between p-4 md:p-6 border-t border-border bg-primary shadow-lg">
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