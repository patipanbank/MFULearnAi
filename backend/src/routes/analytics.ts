import express from 'express';
import { analyticsService } from '../services/analyticsService';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Get analytics overview
router.get('/overview', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange as '1h' | '24h' | '7d' | '30d' || '24h';
    const analytics = await analyticsService.getAnalytics(timeRange);
    
    if (!analytics) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics data'
      });
    }
    
    return res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('❌ Error getting analytics overview:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview'
    });
  }
});

// Get performance metrics
router.get('/performance', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    const metrics = await analyticsService.getPerformanceMetrics();
    
    if (!metrics) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance metrics'
      });
    }
    
    return res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('❌ Error getting performance metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

// Get user activity
router.get('/user-activity', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange as '1h' | '24h' | '7d' | '30d' || '24h';
    const analytics = await analyticsService.getAnalytics(timeRange);
    
    if (!analytics) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve user activity data'
      });
    }
    
    return res.json({
      success: true,
      data: {
        totalEvents: analytics.events.userActivity,
        recentEvents: analytics.recentEvents.userActivity,
        activeUsers: analytics.stats.activeUsers
      }
    });
  } catch (error) {
    console.error('❌ Error getting user activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user activity'
    });
  }
});

// Get agent usage statistics
router.get('/agent-usage', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange as '1h' | '24h' | '7d' | '30d' || '24h';
    const analytics = await analyticsService.getAnalytics(timeRange);
    
    if (!analytics) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve agent usage data'
      });
    }
    
    return res.json({
      success: true,
      data: {
        totalUsage: analytics.events.agentUsage,
        agentStats: analytics.stats.agentStats,
        recentUsage: analytics.recentEvents.agentUsage
      }
    });
  } catch (error) {
    console.error('❌ Error getting agent usage:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent usage'
    });
  }
});

// Get tool usage statistics
router.get('/tool-usage', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange as '1h' | '24h' | '7d' | '30d' || '24h';
    const analytics = await analyticsService.getAnalytics(timeRange);
    
    if (!analytics) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve tool usage data'
      });
    }
    
    return res.json({
      success: true,
      data: {
        totalUsage: analytics.events.toolUsage,
        toolStats: analytics.stats.toolStats,
        recentUsage: analytics.recentEvents.toolUsage
      }
    });
  } catch (error) {
    console.error('❌ Error getting tool usage:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get tool usage'
    });
  }
});

// Get chat events
router.get('/chat-events', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange as '1h' | '24h' | '7d' | '30d' || '24h';
    const analytics = await analyticsService.getAnalytics(timeRange);
    
    if (!analytics) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve chat events data'
      });
    }
    
    return res.json({
      success: true,
      data: {
        totalEvents: analytics.events.chatEvents,
        recentEvents: analytics.recentEvents.chatEvents
      }
    });
  } catch (error) {
    console.error('❌ Error getting chat events:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat events'
    });
  }
});

// Clean up old analytics data (admin only)
router.post('/cleanup', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    await analyticsService.cleanupOldData();
    
    return res.json({
      success: true,
      message: 'Analytics data cleanup completed successfully'
    });
  } catch (error) {
    console.error('❌ Error cleaning up analytics data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cleanup analytics data'
    });
  }
});

// Export analytics data (admin only)
router.get('/export', authenticateJWT, requireAdmin, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange as '1h' | '24h' | '7d' | '30d' || '24h';
    const analytics = await analyticsService.getAnalytics(timeRange);
    
    if (!analytics) {
      return res.status(500).json({
        success: false,
        error: 'Failed to export analytics data'
      });
    }
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`);
    
    // Convert to CSV format
    const csvData = convertToCSV(analytics);
    return res.send(csvData);
  } catch (error) {
    console.error('❌ Error exporting analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export analytics data'
    });
  }
});

// Helper function to convert analytics data to CSV
function convertToCSV(analytics: any): string {
  const headers = ['Type', 'Count', 'Timestamp'];
  const rows: any[] = [];
  
  // Add event counts
  Object.entries(analytics.events).forEach(([type, count]) => {
    rows.push([type, count, new Date().toISOString()]);
  });
  
  // Add agent stats
  Object.entries(analytics.stats.agentStats).forEach(([agentId, count]) => {
    rows.push([`agent_${agentId}`, count, new Date().toISOString()]);
  });
  
  // Add tool stats
  Object.entries(analytics.stats.toolStats).forEach(([toolName, count]) => {
    rows.push([`tool_${toolName}`, count, new Date().toISOString()]);
  });
  
  const csvContent = [headers, ...rows]
    .map(row => row.map((cell: any) => `"${cell}"`).join(','))
    .join('\n');
  
  return csvContent;
}

export default router; 