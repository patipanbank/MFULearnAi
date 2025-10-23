import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../shared/stores';
import { FiUser, FiMail, FiBriefcase, FiCalendar, FiShield, FiUsers, FiActivity } from 'react-icons/fi';
import Loading from '../../shared/ui/Loading';
import { formatDate } from '../../shared/lib/utils';

const ProfilePage: React.FC = () => {
  const { user, status, fetchUser } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Fetch user data if not loaded
    if (!user && status !== 'loading') {
      fetchUser();
    }
  }, [user, status, fetchUser]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUser();
    setIsRefreshing(false);
  };

  if (status === 'loading' || isRefreshing) {
    return <Loading />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-primary mb-4">Unable to load profile</h2>
          <button onClick={handleRefresh} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const profileSections = [
    {
      title: 'Basic Information',
      icon: FiUser,
      items: [
        { label: 'Username', value: user.username, icon: FiUser },
        { label: 'Email', value: user.email, icon: FiMail },
        { label: 'First Name', value: user.firstName || 'N/A', icon: FiUser },
        { label: 'Last Name', value: user.lastName || 'N/A', icon: FiUser },
      ]
    },
    {
      title: 'Organization',
      icon: FiBriefcase,
      items: [
        { label: 'Department', value: user.department || 'N/A', icon: FiBriefcase },
        { label: 'Role', value: user.role, icon: FiShield },
        { label: 'Groups', value: user.groups?.length > 0 ? user.groups.length : 'None', icon: FiUsers },
      ]
    },
    {
      title: 'Usage & Limits',
      icon: FiActivity,
      items: [
        { label: 'Token Quota', value: user.tokenQuota?.toLocaleString() || 'N/A', icon: FiActivity },
        { label: 'Daily Token Limit', value: user.dailyTokenLimit?.toLocaleString() || 'N/A', icon: FiActivity },
        {
          label: 'Total Usage',
          value: user.usage?.total_tokens ? `${user.usage.total_tokens.toLocaleString()} tokens` : 'N/A',
          icon: FiActivity
        },
        {
          label: 'Total Requests',
          value: user.usage?.total_requests?.toLocaleString() || 'N/A',
          icon: FiActivity
        },
      ]
    },
    {
      title: 'Account Information',
      icon: FiCalendar,
      items: [
        { label: 'Created', value: user.created ? formatDate(user.created) : 'N/A', icon: FiCalendar },
        { label: 'Last Updated', value: user.updated ? formatDate(user.updated) : 'N/A', icon: FiCalendar },
        { label: 'Last Login', value: user.lastLogin ? formatDate(user.lastLogin) : 'N/A', icon: FiCalendar },
      ]
    }
  ];

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'Admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Staffs':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Students':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  // Get initials for avatar
  const getInitials = () => {
    if (!user.firstName && !user.lastName) {
      return user.username?.charAt(0).toUpperCase() || 'U';
    }
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-primary">My Profile</h1>
          <button
            onClick={handleRefresh}
            className="btn-secondary"
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="text-muted">View and manage your account information</p>
      </div>

      {/* Profile Card */}
      <div className="card mb-8">
        <div className="flex items-center space-x-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {getInitials()}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-primary mb-2">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.username}
            </h2>
            <div className="flex items-center space-x-4 text-muted">
              <div className="flex items-center space-x-2">
                <FiMail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {profileSections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.title} className="card">
              <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <SectionIcon className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-primary">{section.title}</h3>
              </div>
              <div className="space-y-3">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <ItemIcon className="w-4 h-4 text-muted" />
                        <span className="text-sm font-medium text-muted">{item.label}</span>
                      </div>
                      <span className="text-sm text-primary font-medium">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug Info (Development Only) */}
      {import.meta.env.DEV && (
        <div className="mt-8 card bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-primary mb-4">Debug Info (Dev Only)</h3>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
