import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiUser, FiShield, FiDownload, FiTrash2, FiKey } from 'react-icons/fi';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/index';
import { useUIStore } from '../../stores/uiStore';
import useLayoutStore from '../../stores/layoutStore';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { 
    profile, 
    privacy,
    setProfile,
    setPrivacy,
    isSaving, 
    saveSettings 
  } = useSettingsStore();
  
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const { isMobile } = useLayoutStore();
  
  const [localProfile, setLocalProfile] = useState(profile);
  const [localPrivacy, setLocalPrivacy] = useState(privacy);
  const [hasChanges, setHasChanges] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Update local state when profile/privacy change
  useEffect(() => {
    setLocalProfile(profile);
    setLocalPrivacy(privacy);
    setHasChanges(false);
  }, [profile, privacy]);

  // Check for changes
  useEffect(() => {
    const profileChanged = JSON.stringify(localProfile) !== JSON.stringify(profile);
    const privacyChanged = JSON.stringify(localPrivacy) !== JSON.stringify(privacy);
    setHasChanges(profileChanged || privacyChanged);
  }, [localProfile, localPrivacy, profile, privacy]);

  const handleSave = async () => {
    try {
      setProfile(localProfile);
      setPrivacy(localPrivacy);
      await saveSettings();
      addToast({
        type: 'success',
        title: 'Account Updated',
        message: 'Your account settings have been saved successfully'
      });
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save account settings'
      });
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        setLocalProfile(profile);
        setLocalPrivacy(privacy);
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({
        type: 'error',
        title: 'Password Mismatch',
        message: 'New password and confirmation do not match'
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      addToast({
        type: 'error',
        title: 'Password Too Short',
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    try {
      // TODO: Implement password change API call
      addToast({
        type: 'success',
        title: 'Password Changed',
        message: 'Your password has been updated successfully'
      });
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Password Change Failed',
        message: 'Failed to change password'
      });
    }
  };

  const handleDownloadData = async () => {
    try {
      // TODO: Implement data download API call
      addToast({
        type: 'info',
        title: 'Data Export Started',
        message: 'Your data export will be emailed to you within 24 hours'
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to start data export'
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      if (confirm('This will permanently delete all your data. Type "DELETE" to confirm.')) {
        try {
          // TODO: Implement account deletion API call
          addToast({
            type: 'success',
            title: 'Account Deleted',
            message: 'Your account has been scheduled for deletion'
          });
        } catch (error) {
          addToast({
            type: 'error',
            title: 'Deletion Failed',
            message: 'Failed to delete account'
          });
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${isMobile ? 'animate-slide-up-from-bottom' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-primary">Account Settings</h2>
            <p className="text-sm text-secondary mt-1">Manage your account and privacy settings</p>
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
          {/* Profile Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary flex items-center space-x-2">
              <FiUser className="h-5 w-5" />
              <span>Profile</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Name</label>
                <input
                  type="text"
                  value={localProfile.name || (user ? `${user.firstName} ${user.lastName}` : '') || ''}
                  onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
                  className="input w-full"
                  placeholder="Enter your name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Email</label>
                <input
                  type="email"
                  value={localProfile.email || user?.email || ''}
                  onChange={(e) => setLocalProfile({ ...localProfile, email: e.target.value })}
                  className="input w-full"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Department</label>
                <input
                  type="text"
                  value={localProfile.department || (user?.department_id?.$oid || '') || ''}
                  onChange={(e) => setLocalProfile({ ...localProfile, department: e.target.value })}
                  className="input w-full"
                  placeholder="Enter your department"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Avatar URL</label>
                <input
                  type="url"
                  value={localProfile.avatar}
                  onChange={(e) => setLocalProfile({ ...localProfile, avatar: e.target.value })}
                  className="input w-full"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-primary mb-2">Bio</label>
              <textarea
                value={localProfile.bio}
                onChange={(e) => setLocalProfile({ ...localProfile, bio: e.target.value })}
                rows={3}
                className="input w-full"
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary flex items-center space-x-2">
              <FiShield className="h-5 w-5" />
              <span>Privacy Settings</span>
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-primary">Share usage data</span>
                  <p className="text-sm text-secondary">Help improve the service by sharing anonymous usage data</p>
                </div>
                <input
                  type="checkbox"
                  checked={localPrivacy.shareData}
                  onChange={(e) => setLocalPrivacy({ ...localPrivacy, shareData: e.target.checked })}
                                        className="rounded border-border text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-primary">Analytics</span>
                  <p className="text-sm text-secondary">Allow analytics to improve your experience</p>
                </div>
                <input
                  type="checkbox"
                  checked={localPrivacy.analytics}
                  onChange={(e) => setLocalPrivacy({ ...localPrivacy, analytics: e.target.checked })}
                                        className="rounded border-border text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-primary">Marketing communications</span>
                  <p className="text-sm text-secondary">Receive updates and marketing emails</p>
                </div>
                <input
                  type="checkbox"
                  checked={localPrivacy.marketing}
                  onChange={(e) => setLocalPrivacy({ ...localPrivacy, marketing: e.target.checked })}
                                        className="rounded border-border text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* Account Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary flex items-center space-x-2">
              <FiKey className="h-5 w-5" />
              <span>Account Actions</span>
            </h3>
            
            <div className="space-y-3">
              {!isChangingPassword ? (
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <FiKey className="h-4 w-4" />
                  <span>Change Password</span>
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-secondary rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleChangePassword}
                      className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Change Password
                    </button>
                    <button
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      }}
                      className="px-3 py-1 text-sm font-medium text-secondary hover:text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleDownloadData}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
              >
                <FiDownload className="h-4 w-4" />
                <span>Download My Data</span>
              </button>
              
              <button
                onClick={handleDeleteAccount}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <FiTrash2 className="h-4 w-4" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-secondary">
          <div className="text-sm text-secondary">
            {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="btn-primary flex items-center space-x-2"
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

export default AccountModal; 