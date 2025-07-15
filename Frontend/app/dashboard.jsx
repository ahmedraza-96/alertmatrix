import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, Redirect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { AuthContext } from '../contexts/AuthContext';
import { AlertContext } from '../contexts/AlertContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Header from '../components/ui/Header';
import { colors, typography, spacing, shadows } from '../styles/theme';

const Dashboard = () => {
  const { isAuthenticated, signOut } = useContext(AuthContext);
  const { alerts, notificationsEnabled } = useContext(AlertContext);
  const [reportType, setReportType] = useState('daily'); // 'daily' or 'weekly'
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Redirect to Sign In if not authenticated using Redirect component
  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  const handleSignOut = () => {
    signOut();
    router.replace('/');
  };

  const activeAlerts = []; // Disabled: alerts.filter(alert => alert.status === 'active' || !alert.status);
  const recentAlerts = []; // Disabled: alerts.slice(0, 3);

  // Reports functionality
  const getReportData = () => {
    const now = new Date();
    let startDate;
    
    if (reportType === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    return alerts.filter(alert => {
      const alertDate = new Date(alert.timestamp || alert.created_at);
      return alertDate >= startDate;
    });
  };

  const reportData = getReportData();
  
  const getReportStats = () => {
    const total = reportData.length;
    const active = reportData.filter(alert => alert.status === 'active' || !alert.status).length;
    const resolved = reportData.filter(alert => alert.status === 'resolved').length;
    const acknowledged = reportData.filter(alert => alert.status === 'acknowledged').length;
    
    return { total, active, resolved, acknowledged };
  };

  const generatePDFReport = async () => {
    setGeneratingPDF(true);
    try {
      const stats = getReportStats();
      const currentDate = new Date().toLocaleDateString();
      const reportTitle = reportType === 'daily' ? 'Daily Report' : 'Weekly Report';
      
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563EB; padding-bottom: 20px; }
              .logo { color: #2563EB; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
              .stats { display: flex; justify-content: space-around; margin: 30px 0; }
              .stat-card { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin: 0 10px; }
              .stat-number { font-size: 24px; font-weight: bold; color: #2563EB; }
              .stat-label { color: #666; margin-top: 5px; }
              .alerts-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
              .alerts-table th, .alerts-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              .alerts-table th { background-color: #f8f9fa; font-weight: bold; }
              .status-active { color: #EF4444; font-weight: bold; }
              .status-resolved { color: #10B981; font-weight: bold; }
              .status-acknowledged { color: #F59E0B; font-weight: bold; }
              .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">🛡️ AlertMatrix</div>
              <h1>${reportTitle}</h1>
              <p>Generated on: ${currentDate}</p>
            </div>
            
            <div class="stats">
              <div class="stat-card">
                <div class="stat-number">${stats.total}</div>
                <div class="stat-label">Total Alerts</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${stats.active}</div>
                <div class="stat-label">Active</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${stats.acknowledged}</div>
                <div class="stat-label">Acknowledged</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${stats.resolved}</div>
                <div class="stat-label">Resolved</div>
              </div>
            </div>
            
            <table class="alerts-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Camera</th>
                  <th>Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.map(alert => `
                  <tr>
                    <td>${new Date(alert.timestamp || alert.created_at).toLocaleString()}</td>
                    <td>${(alert.detection_type || 'WEAPON').toUpperCase()}</td>
                    <td>${alert.camera_id || 'N/A'}</td>
                    <td>${Math.round((alert.confidence || 0) * 100)}%</td>
                    <td class="status-${alert.status || 'active'}">${(alert.status || 'ACTIVE').toUpperCase()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="footer">
              <p>AlertMatrix Security Report - Confidential</p>
              <p>This report contains sensitive security information.</p>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${reportTitle} - AlertMatrix`,
        });
      } else {
        Alert.alert('Success', 'Report generated successfully!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const navigationItems = [
    {
      title: 'Alarm Alert',
      description: 'Monitor and manage alarm notifications',
      icon: 'notification-important',
      color: colors.warning,
      badge: null, // Disabled: activeAlerts.length > 0 ? activeAlerts.length : null,
      route: 'active-alarms',
    },
    {
      title: 'Generated Alerts',
      description: 'Review all detection history',
      icon: 'assignment',
      color: colors.info,
      route: 'generated-alerts',
    },
    {
      title: 'Live Footage',
      description: 'Monitor real-time camera feeds',
      icon: 'video-camera-front',
      color: colors.success,
      route: 'live-footage',
    },
    {
      title: 'Reports',
      description: 'View and download security reports',
      icon: 'assessment',
      color: colors.primary,
      route: 'reports',
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="AlertMatrix"
        subtitle="Security Dashboard"
        rightIcon={
          <MaterialIcons name="logout" size={24} color={colors.white} />
        }
        onRightPress={handleSignOut}
        style={styles.header}
      />
      
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.gradientContainer}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome Back</Text>
          <Text style={styles.welcomeSubtitle}>
            Your security system is actively monitoring and protecting your premises
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            {navigationItems.map((item, index) => (
              <Link key={index} href={item.route} asChild>
                <Card style={styles.actionCard}>
                  <View style={styles.actionContent}>
                    <View style={[styles.actionIconContainer, { backgroundColor: item.color + '15' }]}>
                      <MaterialIcons 
                        name={item.icon} 
                        size={24} 
                        color={item.color} 
                      />
                      {item.badge && (
                        <View style={styles.badgeContainer}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>{item.title}</Text>
                      <Text style={styles.actionDescription} numberOfLines={1}>{item.description}</Text>
                    </View>
                  </View>
                </Card>
              </Link>
            ))}
          </View>
        </View>

        {/* Recent Alerts */}
        {recentAlerts.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Alerts</Text>
              <Link href="generated-alerts" asChild>
                <Text style={styles.sectionLink}>View All</Text>
              </Link>
            </View>
            
            {recentAlerts.map((alert, index) => (
              <Card key={index} elevation="sm" style={styles.alertCard}>
                <View style={styles.alertContent}>
                  <View style={styles.alertInfo}>
                    <View style={styles.alertHeader}>
                      <MaterialIcons 
                        name="warning" 
                        size={20} 
                        color={colors.error} 
                      />
                      <Text style={styles.alertType}>
                        {alert.detection_type?.toUpperCase() || 'WEAPON'} DETECTED
                      </Text>
                    </View>
                    <View style={styles.alertDetails}>
                      <Text style={styles.alertDetail}>
                        Camera: {alert.camera_id}
                      </Text>
                      <Text style={styles.alertDetail}>
                        Confidence: {Math.round(alert.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.alertMeta}>
                    <StatusBadge 
                      status={alert.status || 'active'} 
                      size="small"
                    />
                    <Text style={styles.alertTime}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* System Status */}
        <Card elevation="sm" style={styles.systemCard}>
          <View style={styles.systemHeader}>
            <MaterialIcons name="health-and-safety" size={24} color={colors.success} />
            <Text style={styles.systemTitle}>System Status</Text>
          </View>
          <View style={styles.systemStatus}>
            <View style={styles.statusItem}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>All systems operational</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusIndicator, { backgroundColor: colors.success }]} />
              <Text style={styles.statusText}>Detection service: Online</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusIndicator, { backgroundColor: colors.success }]} />
              <Text style={styles.statusText}>Video streaming: Active</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusIndicator, { backgroundColor: notificationsEnabled ? colors.success : colors.warning }]} />
              <Text style={styles.statusText}>
                Notifications: {notificationsEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Removed Test Notification Section */}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  
  header: {
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
    ...shadows.sm,
  },
  
  gradientContainer: {
    flex: 1,
  },
  
  container: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 10,
  },
  
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  
  welcomeSection: {
    marginBottom: spacing.xl,
    backgroundColor: colors.backgroundAccent,
    borderRadius: 16,
    padding: spacing.lg,
    ...shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  
  welcomeTitle: {
    fontSize: typography['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  
  welcomeSubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.relaxed * typography.base,
  },
  
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  
  sectionLink: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  
  // Actions Section
  actionsSection: {
    marginBottom: spacing.xl,
  },
  
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  actionCard: {
    width: '48%',
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    ...shadows.sm,
  },
  
  actionContent: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
    position: 'relative',
  },
  
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  
  badgeText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.fontWeight.bold,
  },
  
  actionTextContainer: {
    alignItems: 'center',
    width: '100%',
  },
  
  actionTitle: {
    fontSize: typography.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  
  actionDescription: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  // Alerts Section
  alertsSection: {
    marginBottom: spacing.xl,
  },
  
  alertCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    ...shadows.sm,
  },
  
  alertContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  alertInfo: {
    flex: 1,
  },
  
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  
  alertType: {
    fontSize: typography.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  
  alertDetails: {
    gap: spacing.xs / 2,
  },
  
  alertDetail: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  
  alertMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  
  alertTime: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  
  // System Status
  systemCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    ...shadows.sm,
    padding: spacing.md,
  },
  
  systemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  
  systemTitle: {
    fontSize: typography.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  
  systemStatus: {
    gap: spacing.sm,
  },
  
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  
  statusText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },

  // Removed styles related to Test Notification Section
});

export default Dashboard;