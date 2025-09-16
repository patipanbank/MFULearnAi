import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiBarChart, FiSettings, FiDatabase, FiShield, FiArrowLeft, FiBuilding, FiRefreshCw, FiTrendingUp, FiActivity } from 'react-icons/fi';
import { useAuthStore, useUIStore } from '../../shared/stores';
import AdminUserModal from '../../shared/ui/AdminUserModal';
import AdminAnalyticsModal from '../../shared/ui/AdminAnalyticsModal';
import AdminDepartmentModal from '../../shared/ui/AdminDepartmentModal';
import { api } from '../../shared/lib/api';

interface SystemStats {
  totalUsers: number;
  totalDepartments: number;
  activeDepartments: number;
  recentGrowth: number;
}

interface DepartmentStats {
  totalDepartments: number;
  activeDepartments: number;
  emptyDepartments: number;
  userStats: {
    totalUsers: number;
    averageUsersPerDepartment: number;
    maxUsersInDepartment: number;
    minUsersInDepartment: number;
  };
  topDepartments: Array<{
    _id?: string;
    name: string;
    displayName?: string;
    userCount: number;
  }>;
}

const AdminPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  const [showUserModal, setShowUserModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalDepartments: 0,
    activeDepartments: 0,
    recentGrowth: 0
  });
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Check if user is SuperAdmin
  const isSuperAdmin = user?.role === 'SuperAdmin';

  useEffect(() => {
    if (!isSuperAdmin) {
      addToast({
        type: 'error',
        title: 'Access Denied',
        message: 'You need SuperAdmin permissions to access this page'
      });
      navigate('/chat');
      return;
    }

    fetchQuickStats();
  }, [isSuperAdmin, navigate, addToast]);

  const fetchQuickStats = async () => {
    try {
      const [analytics, departmentStats] = await Promise.all([
        api.get<any>('/admin/analytics'),
        api.get<DepartmentStats>('/admin/departments/stats')
      ]);

      setStats({
        totalUsers: analytics.userStats.total,
        totalDepartments: departmentStats.totalDepartments,
        activeDepartments: departmentStats.activeDepartments,
        recentGrowth: 0 // Could be implemented later
      });

      setDepartmentStats(departmentStats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return null; // Will redirect via useEffect
  }

  const managementCards = [
    {
      id: 'users',
      title: 'User Management',
      description: 'Manage users, roles, and permissions across all departments',
      icon: FiUsers,
      color: 'bg-blue-500',
      count: stats.totalUsers,
      countLabel: 'Total Users',
      onClick: () => setShowUserModal(true)
    },
    {
      id: 'departments',
      title: 'Department Management',
      description: 'Manage organizational departments and user distribution',
      icon: FiBuilding,
      color: 'bg-green-500',
      count: stats.activeDepartments,
      countLabel: 'Active Departments',
      onClick: () => setShowDepartmentModal(true)
    },
    {
      id: 'analytics',
      title: 'System Analytics',
      description: 'View user distribution, department stats, and system metrics',
      icon: FiBarChart,
      color: 'bg-purple-500',
      count: departmentStats?.topDepartments.length || 0,
      countLabel: 'Top Departments',
      onClick: () => setShowAnalyticsModal(true)
    },
    {
      id: 'growth',
      title: 'Growth Metrics',
      description: 'Monitor user growth and department expansion',
      icon: FiTrendingUp,
      color: 'bg-orange-500',
      count: stats.recentGrowth,
      countLabel: 'Recent Growth',
      onClick: () => {
        addToast({
          type: 'info',
          title: 'Growth Analytics',
          message: 'Detailed growth metrics will be available in the analytics panel'
        });
        setShowAnalyticsModal(true);
      }
    },
    {
      id: 'system',
      title: 'System Configuration',
      description: 'Configure global system settings and monitoring',
      icon: FiSettings,
      color: 'bg-red-500',
      count: stats.totalDepartments,
      countLabel: 'Total Departments',
      onClick: () => {
        addToast({
          type: 'info',
          title: 'Coming Soon',
          message: 'System configuration panel is under development'
        });
      }
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center space-x-2 text-primary-foreground hover:text-primary-foreground/80 transition-colors"
              >
                <FiArrowLeft className="h-5 w-5" />
                <span>Back to Chat</span>
              </button>
              <div className="h-6 w-px bg-primary-foreground/20"></div>
              <div className="flex items-center space-x-3">
                <FiShield className="h-6 w-6" />
                <div>
                  <h1 className="text-lg font-semibold">System Administration</h1>
                  <p className="text-sm text-primary-foreground/80">MFU Learn AI Platform</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-primary-foreground/80">{user?.role}</p>
              </div>
              <div className="h-8 w-8 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">
                  {(user?.firstName || user?.username)?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-2">Welcome, {user?.firstName || user?.username}</h2>
          <p className="text-secondary">
            Manage your MFU Learn AI platform from this central administration panel.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FiUsers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-secondary">Total Users</p>
                <p className="text-2xl font-bold text-primary">
                  {loading ? '-' : stats.totalUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <FiBuilding className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-secondary">Active Departments</p>
                <p className="text-2xl font-bold text-primary">
                  {loading ? '-' : stats.activeDepartments}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <FiActivity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-secondary">Total Departments</p>
                <p className="text-2xl font-bold text-primary">
                  {loading ? '-' : stats.totalDepartments}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-secondary">Avg Users/Dept</p>
                <p className="text-2xl font-bold text-primary">
                  {loading ? '-' : (departmentStats?.userStats.averageUsersPerDepartment || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Management Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {managementCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.onClick}
                className="card card-hover p-6 cursor-pointer transition-all duration-200 hover:scale-105"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 ${card.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {loading ? '-' : card.count}
                    </p>
                    <p className="text-xs text-secondary">{card.countLabel}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-primary mb-2">{card.title}</h3>
                  <p className="text-sm text-secondary">{card.description}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">Manage</span>
                    <FiArrowLeft className="h-4 w-4 text-muted rotate-180" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 card p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setShowUserModal(true)}
              className="btn-primary flex items-center justify-center space-x-2"
            >
              <FiUsers className="h-4 w-4" />
              <span>Manage Users</span>
            </button>

            <button
              onClick={() => setShowAnalyticsModal(true)}
              className="btn-ghost flex items-center justify-center space-x-2"
            >
              <FiBarChart className="h-4 w-4" />
              <span>View Analytics</span>
            </button>

            <button
              onClick={fetchQuickStats}
              className="btn-ghost flex items-center justify-center space-x-2"
            >
              <FiSettings className="h-4 w-4" />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AdminUserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
      />

      <AdminDepartmentModal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
      />

      <AdminAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
      />
    </div>
  );
};

export default AdminPage;