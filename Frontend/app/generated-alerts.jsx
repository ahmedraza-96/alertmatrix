import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { AuthContext } from '../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Header from '../components/ui/Header';
import { colors, typography, spacing, shadows } from '../styles/theme';
import { API_URL } from '../config/api';

const GeneratedAlerts = () => {
  const { token } = useContext(AuthContext);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/alerts?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      } else {
        console.error('Failed to fetch alerts:', response.status);
        Alert.alert('Error', 'Failed to load alerts');
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      Alert.alert('Error', 'Network error while loading alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateAlertStatus = async (alertId, status) => {
    try {
      const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Update local state
        setAlerts(alerts.map(alert => 
          alert._id === alertId ? { ...alert, status } : alert
        ));
        Alert.alert('Success', `Alert marked as ${status}`);
      } else {
        Alert.alert('Error', 'Failed to update alert status');
      }
    } catch (error) {
      console.error('Error updating alert:', error);
      Alert.alert('Error', 'Network error while updating alert');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#ff4444';
      case 'acknowledged': return '#ffaa00';
      case 'resolved': return '#44ff44';
      default: return '#ffffff';
    }
  };

  const getDetectionIcon = (type) => {
    switch (type) {
      case 'gun': return 'warning';
      case 'knife': return 'dangerous';
      default: return 'security';
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Generated Alerts"
          showBackButton
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Generated Alerts"
        subtitle={`${alerts.length} total alerts`}
        showBackButton
        onBackPress={() => router.back()}
        style={styles.header}
      />
      
      <LinearGradient
        colors={[colors.backgroundAccent, colors.background, colors.backgroundSecondary]}
        style={styles.gradientContainer}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >

        {/* Alert List */}
        {alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Card elevation="sm" style={styles.emptyCard}>
              <MaterialIcons name="security" size={64} color={colors.textLight} />
              <Text style={styles.emptyText}>No alerts found</Text>
              <Text style={styles.emptySubtext}>Detection alerts will appear here</Text>
              <Text style={styles.emptyDescription}>
                Your security system will log all detection events in this section for review and analysis.
              </Text>
            </Card>
          </View>
        ) : (
          <View style={styles.alertsList}>
            {alerts.map((alert) => (
              <Card key={alert._id} elevation="md" style={styles.alertCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.alertTypeContainer}>
                    <View style={styles.alertIcon}>
                      <MaterialIcons 
                        name={getDetectionIcon(alert.detection_type)} 
                        size={20} 
                        color={colors.textSecondary} 
                      />
                    </View>
                    <View style={styles.alertInfo}>
                      <Text style={styles.cardTitle}>
                        {alert.detection_type?.toUpperCase() || 'WEAPON'} DETECTED
                      </Text>
                      <Text style={styles.alertDate}>{formatDate(alert.timestamp)}</Text>
                    </View>
                  </View>
                  <StatusBadge 
                    status={alert.status || 'active'} 
                    size="small" 
                  />
                </View>
                
                <View style={styles.cardContent}>
                  <View style={styles.alertDetailRow}>
                    <MaterialIcons name="videocam" size={16} color={colors.textSecondary} />
                    <Text style={styles.cardDetail}>Camera: {alert.camera_id}</Text>
                  </View>
                  <View style={styles.alertDetailRow}>
                    <MaterialIcons name="analytics" size={16} color={colors.textSecondary} />
                    <Text style={styles.cardDetail}>Confidence: {Math.round(alert.confidence * 100)}%</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {alert.status === 'active' && (
                    <Button
                      title="Acknowledge"
                      variant="secondary"
                      size="small"
                      onPress={() => updateAlertStatus(alert._id, 'acknowledged')}
                      style={styles.actionButton}
                    />
                  )}
                  {alert.status !== 'resolved' && (
                    <Button
                      title="Resolve"
                      variant="primary"
                      size="small"
                      onPress={() => updateAlertStatus(alert._id, 'resolved')}
                      style={styles.actionButton}
                    />
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 0,
    ...shadows.sm,
  },
  
  gradientContainer: {
    flex: 1,
  },
  
  container: {
    flex: 1,
  },
  
  scrollContainer: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  
  loadingText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  
  emptyCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
    ...shadows.md,
  },
  
  emptyText: {
    fontSize: typography['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  
  emptySubtext: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  
  emptyDescription: {
    fontSize: typography.sm,
    color: colors.textLight,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed * typography.sm,
  },
  
  // Alerts List
  alertsList: {
    gap: spacing.md,
  },
  
  alertCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    ...shadows.md,
  },
  
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  
  alertTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  alertInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  
  cardTitle: {
    fontSize: typography.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  
  alertDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  
  cardContent: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  
  alertDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  cardDetail: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  
  actionButton: {
    flex: 0,
    minWidth: 80,
  },
});

export default GeneratedAlerts;