import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  Alert, 
  SafeAreaView, 
  Modal, 
  TextInput, 
  TouchableOpacity 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AuthContext } from '../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Header from '../components/ui/Header';
import { colors, typography, spacing, shadows } from '../styles/theme';
import { API_URL } from '../config/api';

const ActiveAlarms = () => {
  const { token } = useContext(AuthContext);
  const [alarmNotifications, setAlarmNotifications] = useState([]);
  const [associatedAlarms, setAssociatedAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddAlarmModal, setShowAddAlarmModal] = useState(false);
  const [alarmIdInput, setAlarmIdInput] = useState('');
  const [isAddingAlarm, setIsAddingAlarm] = useState(false);

  const fetchUserAlarms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/alarms/user-alarms`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAlarmNotifications(data.alarmNotifications || []);
        setAssociatedAlarms(data.associatedAlarms || []);
      } else {
        console.error('Failed to fetch user alarms:', response.status);
        Alert.alert('Error', 'Failed to load alarm notifications');
      }
    } catch (error) {
      console.error('Error fetching user alarms:', error);
      Alert.alert('Error', 'Network error while loading alarm notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const validateAndAddAlarm = async () => {
    if (!alarmIdInput.trim()) {
      Alert.alert('Error', 'Please enter an Alarm ID');
      return;
    }

    setIsAddingAlarm(true);

    try {
      console.log('🔍 Validating alarm ID:', alarmIdInput.trim());
      console.log('🌐 API URL:', API_URL);
      console.log('🔑 Token:', token ? 'Present' : 'Missing');

      // First validate the alarm ID
      const validateResponse = await fetch(`${API_URL}/api/alarms/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alarm_id: alarmIdInput.trim() }),
      });

      console.log('📡 Validate response status:', validateResponse.status);

      if (validateResponse.status === 404) {
        // Alarm ID does not exist
        const errorData = await validateResponse.json().catch(() => ({ message: 'Alarm not found' }));
        Alert.alert(
          'Invalid Alarm ID',
          errorData?.message || `The alarm ID "${alarmIdInput.trim()}" does not exist. Please try again.`
        );
        setIsAddingAlarm(false);
        return;
      }

      let validateData;
      try {
        validateData = await validateResponse.json();
      } catch (parseError) {
        console.error('Failed to parse validation response:', parseError);
        Alert.alert('Error', 'Invalid response from server');
        setIsAddingAlarm(false);
        return;
      }

      if (!validateResponse.ok) {
        const errorMessage = validateData.message || 'Invalid Alarm ID';
        console.log('❌ Validation failed:', errorMessage);
        Alert.alert(
          'Invalid Alarm ID', 
          `The alarm ID "${alarmIdInput.trim()}" does not exist in the database. Please check the ID and try again.`
        );
        setIsAddingAlarm(false);
        return;
      }

      console.log('✅ Alarm ID validated successfully');

      // If validation successful, associate the alarm
      const associateResponse = await fetch(`${API_URL}/api/alarms/associate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alarm_id: alarmIdInput.trim() }),
      });

      console.log('📡 Associate response status:', associateResponse.status);

      if (associateResponse.status === 404) {
        // This could be because the alarm no longer exists or user couldn't be found
        const errorData = await associateResponse.json().catch(() => ({ message: 'Association failed' }));
        Alert.alert('Error', errorData.message || 'Failed to add alarm.');
        setIsAddingAlarm(false);
        return;
      }

      let associateData;
      try {
        associateData = await associateResponse.json();
      } catch (parseError) {
        console.error('Failed to parse association response:', parseError);
        Alert.alert('Error', 'Invalid response from server');
        setIsAddingAlarm(false);
        return;
      }

      if (associateResponse.ok) {
        console.log('✅ Alarm associated successfully');
        Alert.alert('Success', `Alarm "${alarmIdInput.trim()}" has been successfully added to your account!`);
        setShowAddAlarmModal(false);
        setAlarmIdInput('');
        // Refresh the alarm list
        fetchUserAlarms();
      } else {
        const errorMessage = associateData.message || 'Failed to add alarm';
        console.log('❌ Association failed:', errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('❌ Network error adding alarm:', error);
      Alert.alert(
        'Network Error', 
        'Unable to connect to the server. Please check your internet connection and make sure the backend server is running.'
      );
    } finally {
      setIsAddingAlarm(false);
    }
  };

  const removeAlarm = async (alarmId) => {
    Alert.alert(
      'Remove Alarm',
      `Are you sure you want to stop monitoring alarm ${alarmId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/alarms/disassociate`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ alarm_id: alarmId }),
              });

              if (response.ok) {
                Alert.alert('Success', 'Alarm removed from your account');
                fetchUserAlarms();
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Failed to remove alarm');
              }
            } catch (error) {
              console.error('Error removing alarm:', error);
              Alert.alert('Error', 'Network error while removing alarm');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserAlarms();
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const eventTime = new Date(timestamp);
    const diffMs = now - eventTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getAlarmStatusColor = (armed) => {
    return armed ? colors.success : colors.warning;
  };

  const getAlarmStatusText = (armed) => {
    return armed ? 'ARMED' : 'DISARMED';
  };

  useEffect(() => {
    fetchUserAlarms();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Alarm Alert"
          showBackButton
          onBackPress={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading alarm notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Alarm Alert"
        subtitle={`${associatedAlarms.length} alarm${associatedAlarms.length !== 1 ? 's' : ''} monitored`}
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
          {/* Add Alarm Button */}
          <View style={styles.actionSection}>
            <Button
              title="Add Alarm"
              onPress={() => setShowAddAlarmModal(true)}
              variant="primary"
              style={styles.addAlarmButton}
              icon="add"
            />
          </View>

          {/* Associated Alarms Section */}
          {associatedAlarms.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Monitored Alarms</Text>
              {associatedAlarms.map((alarm, index) => (
                <Card key={index} elevation="sm" style={styles.alarmCard}>
                  <View style={styles.alarmHeader}>
                    <View style={styles.alarmInfo}>
                      <MaterialIcons name="security" size={20} color={colors.primary} />
                      <Text style={styles.alarmId}>{alarm.alarm_id}</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => removeAlarm(alarm.alarm_id)}
                      style={styles.removeButton}
                    >
                      <MaterialIcons name="close" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.alarmDate}>
                    Added: {formatTimestamp(alarm.dateAssociated)}
                  </Text>
                </Card>
              ))}
            </View>
          )}

          {/* Alarm Notifications */}
          {alarmNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Card elevation="sm" style={styles.emptyCard}>
                <MaterialIcons 
                  name={associatedAlarms.length > 0 ? "notifications" : "add-circle-outline"}
                  size={64} 
                  color={associatedAlarms.length > 0 ? colors.success : colors.textSecondary} 
                />
                <Text style={styles.emptyText}>
                  {associatedAlarms.length > 0 ? 'No Alarm Events' : 'No Alarms Added'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {associatedAlarms.length > 0 
                    ? 'No recent alarm events for your monitored alarms' 
                    : 'Add an alarm to start monitoring notifications'
                  }
                </Text>
                <Text style={styles.emptyDescription}>
                  {associatedAlarms.length > 0 
                    ? 'All alarm events and status changes will appear here.'
                    : 'Tap "Add Alarm" to enter an Alarm ID and start receiving notifications.'
                  }
                </Text>
              </Card>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Alarm Events</Text>
              <View style={styles.notificationsList}>
                {alarmNotifications.map((notification, index) => (
                  <Card key={notification._id || index} elevation="md" style={styles.notificationCard}>
                    <View style={styles.notificationHeader}>
                      <View style={styles.notificationInfo}>
                        <View style={styles.alarmIconContainer}>
                          <MaterialIcons 
                            name="notification_important" 
                            size={24} 
                            color={getAlarmStatusColor(notification.armed)} 
                          />
                        </View>
                        <View style={styles.notificationDetails}>
                          <Text style={styles.notificationTitle}>
                            Alarm {notification.alarm_id}
                          </Text>
                          <Text style={styles.notificationTime}>
                            {getTimeAgo(notification.timestamp)}
                          </Text>
                        </View>
                      </View>
                      <StatusBadge 
                        status={notification.armed ? "active" : "inactive"} 
                        text={getAlarmStatusText(notification.armed)} 
                        size="small" 
                      />
                    </View>
                    
                    <View style={styles.notificationMetadata}>
                      <View style={styles.metadataRow}>
                        <MaterialIcons name="schedule" size={16} color={colors.textSecondary} />
                        <Text style={styles.metadataText}>
                          {formatTimestamp(notification.timestamp)}
                        </Text>
                      </View>
                      <View style={styles.metadataRow}>
                        <MaterialIcons name="layers" size={16} color={colors.textSecondary} />
                        <Text style={styles.metadataText}>
                          Partition: {notification.partition}
                        </Text>
                      </View>
                      <View style={styles.metadataRow}>
                        <MaterialIcons 
                          name={notification.armed ? "lock" : "lock_open"} 
                          size={16} 
                          color={colors.textSecondary} 
                        />
                        <Text style={styles.metadataText}>
                          Status: {getAlarmStatusText(notification.armed)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>

      {/* Add Alarm Modal */}
      <Modal
        visible={showAddAlarmModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddAlarmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Alarm</Text>
              <TouchableOpacity
                onPress={() => setShowAddAlarmModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Enter the Alarm ID you want to monitor. You'll receive notifications for all events from this alarm.
            </Text>
            
            <TextInput
              style={styles.alarmInput}
              placeholder="Enter Alarm ID (e.g., ALM_232)"
              value={alarmIdInput}
              onChangeText={setAlarmIdInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowAddAlarmModal(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title={isAddingAlarm ? "Adding..." : "Add Alarm"}
                onPress={validateAndAddAlarm}
                variant="primary"
                style={styles.modalButton}
                disabled={isAddingAlarm || !alarmIdInput.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
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
  
  // Action Section
  actionSection: {
    marginBottom: spacing.xl,
  },
  addAlarmButton: {
    marginBottom: spacing.md,
  },
  
  // Section Styles
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  
  // Associated Alarms
  alarmCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alarmInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alarmId: {
    fontSize: typography.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  alarmDate: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  removeButton: {
    padding: spacing.xs,
    borderRadius: 4,
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: typography.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: typography.sm,
    color: colors.textLight,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed * typography.sm,
  },
  
  // Notifications List
  notificationsList: {
    gap: spacing.md,
  },
  notificationCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alarmIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  notificationTitle: {
    fontSize: typography.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  notificationTime: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  notificationMetadata: {
    gap: spacing.sm,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalDescription: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: typography.lineHeight.relaxed * typography.base,
  },
  alarmInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.base,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});

export default ActiveAlarms;