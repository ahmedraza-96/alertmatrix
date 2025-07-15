import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Platform } from '../utils/platform';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import { AlertContext } from '../contexts/AlertContext';
import Constants from 'expo-constants';
import LiveVideoStream from '../components/LiveVideoStream';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Header from '../components/ui/Header';
import { colors, typography, spacing, borderRadius, shadows } from '../styles/theme';
import Input from '../components/ui/Input';
import { ENV_CONFIG } from '../config/env';

const API_URL = Constants?.expoConfig?.extra?.API_URL || process.env.EXPO_PUBLIC_API_URL || ENV_CONFIG.API_URL;
const YOLO_SERVICE_URL = Constants?.expoConfig?.extra?.YOLO_SERVICE_URL || process.env.EXPO_PUBLIC_YOLO_SERVICE_URL || ENV_CONFIG.YOLO_SERVICE_URL;
const VIDEO_STREAM_URL = `${YOLO_SERVICE_URL}/video_feed`;
const { width, height } = Dimensions.get('window');

const LiveFootage = () => {
  const { isAuthenticated, token } = useContext(AuthContext);
  const { alerts, hasLiveAccess, userCameraId, refreshCameraAccess } = useContext(AlertContext);
  
  const [streamUrl, setStreamUrl] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cameraIdInput, setCameraIdInput] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [showAddCameraDialog, setShowAddCameraDialog] = useState(false);

  // Fetch video stream URL and detection status
  const fetchStreamData = async () => {
    try {
      setError(null);
      
      // First, try to set the direct video stream URL
      const directStreamConnected = await tryDirectStreamConnection();
      
      if (!directStreamConnected) {
        // If direct connection fails, try backend
        try {
          const streamResponse = await fetch(`${API_URL}/video-stream-url`);
          
          if (streamResponse.ok) {
            const streamData = await streamResponse.json();
            
            if (streamData.success && streamData.streamUrl) {
              let url = streamData.streamUrl;
              if (url && url.includes('localhost')) {
                url = url.replace('localhost', '10.0.2.2');
              }
              setStreamUrl(url);
              console.log('Stream URL received from backend:', url);
            }
          } else {
            throw new Error(`Backend server error: ${streamResponse.status}`);
          }
        } catch (backendError) {
          console.log('Backend also failed:', backendError.message);
          throw new Error('Video service is currently offline. Please start the detection service.');
        }
      }
      
      // Fetch detection status
      try {
        const statusResponse = await fetch(`${API_URL}/api/detection-status`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.success) {
            setDetectionStatus(statusData);
          }
        }
      } catch (statusError) {
        console.log('Status fetch failed:', statusError.message);
        // Set basic status if service is detected but backend is not available
        if (streamUrl) {
          setDetectionStatus({ status: 'active' });
        }
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Error fetching stream data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Ping detection service health
  const checkDetectionServiceHealth = async () => {
    try {
      console.log('🔍 Checking detection service health:', `${YOLO_SERVICE_URL}/api/status`);
      const response = await fetch(`${YOLO_SERVICE_URL}/api/status`, {
        timeout: 5000,
      });
      console.log('Health check response:', response.status);
      return response.ok;
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      return false;
    }
  };

  const tryDirectStreamConnection = async () => {
    try {
      // Try direct connection to the video feed first
      let directUrl = VIDEO_STREAM_URL;
      
      // Fix localhost for mobile (Android emulator)
      if (Platform.OS === 'android' && directUrl.includes('localhost')) {
        directUrl = directUrl.replace('localhost', '10.0.2.2');
      }
      
      console.log('Trying direct video stream connection:', directUrl);
      
      // Test if the video feed endpoint is accessible
      const isHealthy = await checkDetectionServiceHealth();
      if (isHealthy) {
        setStreamUrl(directUrl);
        setError(null);
        console.log('✅ Direct video stream connected:', directUrl);
        console.log('🎬 Setting streamUrl in state:', directUrl);
        return true;
      }
      
      // If health check fails, try backend proxy
      const backendStreamUrl = `${API_URL}/api/video-stream`;
      try {
        const testResponse = await fetch(backendStreamUrl, { 
          method: 'HEAD',
          timeout: 30000 
        });
        if (testResponse.ok || testResponse.status === 200) {
          setStreamUrl(backendStreamUrl);
          setError(null);
          console.log('✅ Using backend proxy stream');
          return true;
        }
      } catch (proxyError) {
        console.log('Backend proxy not available:', proxyError.message);
      }
      
    } catch (err) {
      console.error('❌ Direct stream connection failed:', err);
    }
    return false;
  };

  useEffect(() => {
    if (isAuthenticated && hasLiveAccess) {
      // Initial connection attempt
      console.log('🎬 Initializing video stream connection...');
      fetchStreamData();
      
      // Refresh status every 30 seconds
      const interval = setInterval(fetchStreamData, 30000);
      
      // Health check every 10 seconds
      const healthInterval = setInterval(async () => {
        const isHealthy = await checkDetectionServiceHealth();
        if (!isHealthy && detectionStatus?.status === 'active') {
          setDetectionStatus(prev => prev ? { ...prev, status: 'inactive' } : null);
          console.log('⚠️ Detection service went offline');
        } else if (isHealthy && (!detectionStatus || detectionStatus?.status === 'inactive')) {
          const connected = await tryDirectStreamConnection();
          if (connected && !detectionStatus) {
            setDetectionStatus({ status: 'active' });
            console.log('✅ Detection service back online');
          }
        }
      }, 10000);
      
      return () => {
        clearInterval(interval);
        clearInterval(healthInterval);
      };
    }
  }, [isAuthenticated, hasLiveAccess]);

  useEffect(() => {
    if (!loading && error && isAuthenticated && hasLiveAccess) {
      tryDirectStreamConnection();
    }
  }, [loading, error, isAuthenticated, hasLiveAccess]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStreamData();
  };

  const handleVideoStreamError = (errorMessage) => {
    console.error('🚨 Video stream error:', errorMessage);
    console.error('Current stream URL:', streamUrl);
    // Don't set error state here as the component handles its own error display
  };

  const handleVideoStreamLoad = () => {
    console.log('✅ Video stream loaded successfully');
    console.log('Stream URL used:', streamUrl);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'inactive':
        return '#f44336';
      default:
        return '#FF9800';
    }
  };

  const getDetectionTypeColor = (type) => {
    switch (type) {
      case 'gun':
        return '#f44336';
      case 'knife':
        return '#FF5722';
      default:
        return '#2196F3';
    }
  };

  const handleLinkCamera = async (retry = false) => {
    if (!cameraIdInput.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/camera/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ cameraId: cameraIdInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setCameraError(null);
        setCameraIdInput('');
        // Refresh camera access status in AlertContext
        await refreshCameraAccess();
      } else {
        const message = data.message || 'Camera validation failed';

        // If camera does not exist, attempt to register it automatically
        if (res.status === 404 && message.toLowerCase().includes('invalid')) {
          console.log('Camera not found – attempting automatic registration…');
          try {
            const regRes = await fetch(`${API_URL}/api/camera/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cameraId: cameraIdInput.trim() }),
            });
            const regData = await regRes.json().catch(() => ({}));

            if (regRes.ok && regData.success) {
              console.log('Camera registered, retrying link…');
              // Retry linking once
              if (!retry) handleLinkCamera(true);
              return;
            } else {
              setCameraError(message);
            }
          } catch (regErr) {
            console.log('Camera registration attempt failed:', regErr.message);
            setCameraError(message);
          }
        } else {
          setCameraError(message);
        }
      }
    } catch (err) {
      setCameraError('Unable to verify Camera ID. Please check your connection.');
      console.log('Camera link exception', err.message);
    }
  };

  const renderAddCameraDialog = () => (
    <Modal visible={showAddCameraDialog || (!hasLiveAccess)} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Card elevation="md" style={styles.addCameraCard}>
            <Text style={styles.addCameraTitle}>Add Camera</Text>
            <Input
              placeholder="Enter Camera ID"
              value={cameraIdInput}
              onChangeText={setCameraIdInput}
              variant="filled"
              size="large"
              autoCapitalize="none"
              autoCorrect={false}
              inputStyle={{ color: colors.textPrimary }}
              style={styles.cameraInput}
            />
            {cameraError && <Text style={styles.cameraErrorText}>{cameraError}</Text>}
            <View style={styles.buttonRowModal}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  if (!hasLiveAccess) {
                    // If user has no camera access, navigate back to dashboard
                    router.back();
                    return;
                  }
                  setShowAddCameraDialog(false);
                  setCameraError(null);
                  setCameraIdInput('');
                }}
                style={[styles.linkCameraButton, { marginRight: spacing.sm }]}
              />
              <Button
                title="Add Camera"
                onPress={() => handleLinkCamera()}
                style={styles.linkCameraButton}
                disabled={!cameraIdInput.trim()}
              />
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Live Footage"
          showBackButton
          onBackPress={() => router.back()}
          style={styles.header}
        />
        <LinearGradient
          colors={[colors.backgroundAccent, colors.background, colors.backgroundSecondary]}
          style={styles.gradientContainer}
        >
          <View style={styles.centerContent}>
            <Card elevation="md" style={styles.errorCard}>
              <MaterialIcons name="security" size={48} color={colors.error} />
              <Text style={styles.errorText}>Please log in to view live footage</Text>
            </Card>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Live Footage"
        subtitle="Real-time Security Monitoring"
        showBackButton
        onBackPress={() => router.back()}
        style={styles.header}
        rightIcon={
          detectionStatus && (
            <StatusBadge 
              status={detectionStatus.status === 'active' ? 'online' : 'inactive'}
              text={detectionStatus.status === 'active' ? 'LIVE' : 'OFFLINE'}
              size="small"
            />
          )
        }
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

        {/* Loading State */}
        {loading && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading video feed...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>⚠️ Connection Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Target URL: {Platform.OS === 'android' ? VIDEO_STREAM_URL.replace('localhost', '10.0.2.2') : VIDEO_STREAM_URL}
            </Text>
            <Text style={styles.errorHint}>
              Make sure the detection service is running on port 5000
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setError(null);
                  setLoading(true);
                  fetchStreamData();
                }}
              >
                <Text style={styles.retryButtonText}>Retry Connection</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.retryButton, styles.directTestButton]}
                onPress={async () => {
                  setLoading(true);
                  setError(null);
                  const connected = await tryDirectStreamConnection();
                  if (!connected) {
                    setError('Direct connection to video feed failed');
                  }
                  setLoading(false);
                }}
              >
                <Text style={styles.retryButtonText}>Test Direct</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Add another camera button */}
        <View style={styles.addAnotherContainer}>
          <Button
            title="Add Camera"
            variant="outline"
            onPress={() => {
              setCameraIdInput('');
              setCameraError(null);
              setShowAddCameraDialog(true);
            }}
          />
        </View>

        {/* Video Stream */}
        {streamUrl && !loading && !error && (
          <View style={styles.videoContainer}>
            <View style={styles.videoHeader}>
              <View style={styles.videoTitleContainer}>
                <Text style={styles.sectionTitle}>Live Video Stream</Text>
                <Text style={styles.streamUrlText}>
                  {streamUrl?.replace('10.0.2.2', 'localhost') || 'No URL'}
                </Text>
              </View>
            </View>
            
            <View style={styles.videoStreamContainer}>
              <LiveVideoStream
                streamUrl={streamUrl}
                style={styles.videoStream}
                onError={handleVideoStreamError}
                onLoad={handleVideoStreamLoad}
                fallbackToWebView={true}
              />
              
              {/* Stream overlay with info */}
              <View style={styles.streamOverlay}>
                <View style={styles.streamInfo}>
                  <Text style={styles.streamInfoText}>🔴 LIVE</Text>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(detectionStatus?.status) }]} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Fallback when video service is not available */}
        {!streamUrl && !loading && !error && (
          <View style={styles.fallbackContainer}>
            <View style={styles.fallbackContent}>
              <Text style={styles.fallbackIcon}>📹</Text>
              <Text style={styles.fallbackTitle}>Video Service Unavailable</Text>
              <Text style={styles.fallbackText}>
                Cannot connect to video stream at {VIDEO_STREAM_URL}
              </Text>
              <Text style={styles.fallbackInstructions}>
                To start video streaming:
                {'\n'}1. Navigate to the Yolo5 directory
                {'\n'}2. Run: python enhanced_detection_service.py
                {'\n'}3. Ensure service is running on port 5000
                {'\n'}4. Refresh this page
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLoading(true);
                  fetchStreamData();
                }}
              >
                <Text style={styles.retryButtonText}>🔄 Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Detection Status */}
        {detectionStatus && !loading && (
          <View style={styles.statusContainer}>
            <Text style={styles.sectionTitle}>Detection Status</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Service Status:</Text>
                <Text style={[styles.statusValue, { color: getStatusColor(detectionStatus.status) }]}>
                  {detectionStatus.status.toUpperCase()}
                </Text>
              </View>
              
              {detectionStatus.lastAlert && (
                <>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Last Detection:</Text>
                    <Text style={[styles.statusValue, { color: getDetectionTypeColor(detectionStatus.lastAlert.detection_type) }]}>
                      {detectionStatus.lastAlert.detection_type.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Confidence:</Text>
                    <Text style={styles.statusValue}>
                      {Math.round(detectionStatus.lastAlert.confidence * 100)}%
                    </Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Time:</Text>
                    <Text style={styles.statusValue}>
                      {new Date(detectionStatus.lastAlert.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </>
              )}
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Total Alerts:</Text>
                <Text style={styles.statusValue}>{alerts.length}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Alerts Preview */}
        {hasLiveAccess && alerts.length > 0 && (
          <View style={styles.recentAlertsContainer}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            <View style={styles.recentAlertsList}>
              {alerts.slice(0, 3).map((alert, index) => (
                <View key={alert.id || index} style={styles.recentAlertItem}>
                  <View style={styles.recentAlertInfo}>
                    <Text style={[styles.recentAlertType, { color: getDetectionTypeColor(alert.detection_type) }]}>
                      {alert.detection_type?.toUpperCase() || 'UNKNOWN'}
                    </Text>
                    <Text style={styles.recentAlertTime}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.recentAlertConfidence}>
                    {Math.round((alert.confidence || 0) * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {renderAddCameraDialog()}
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
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  
  loadingText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  
  errorCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  
  errorText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  
  errorHint: {
    fontSize: typography.sm,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: typography.lineHeight.relaxed * typography.sm,
  },
  
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    flex: 1,
    maxWidth: 120,
  },
  
  directTestButton: {
    backgroundColor: colors.success,
  },
  
  retryButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  videoContainer: {
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  
  videoTitleContainer: {
    flex: 1,
  },
  
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  
  streamUrlText: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginTop: 2,
  },
  

  videoStreamContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16/9,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.black,
    marginVertical: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary + '40',
    ...shadows.lg,
  },
  videoStream: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.black,
  },
  
  streamOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1000,
  },
  
  streamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  
  streamInfoText: {
    color: colors.error,
    fontSize: typography.xs,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.xs,
  },
  
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusContainer: {
    marginBottom: spacing.lg,
  },
  
  statusCard: {
    marginTop: spacing.sm,
  },
  
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  
  statusLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  
  statusValue: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  recentAlertsContainer: {
    marginBottom: spacing.lg,
  },
  
  recentAlertsList: {
    marginTop: spacing.sm,
  },
  
  recentAlertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  
  recentAlertInfo: {
    flex: 1,
  },
  
  recentAlertType: {
    fontSize: typography.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  
  recentAlertTime: {
    color: colors.textLight,
    fontSize: typography.xs,
    marginTop: 2,
  },
  
  recentAlertConfidence: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  debugInfo: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    zIndex: 1000,
  },
  
  debugText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  
  fallbackContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  
  fallbackContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  
  fallbackIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  
  fallbackTitle: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  
  fallbackText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  
  fallbackInstructions: {
    color: colors.textLight,
    fontSize: typography.xs,
    textAlign: 'left',
    marginBottom: spacing.lg,
    lineHeight: typography.lineHeight.relaxed * typography.xs,
  },
  addCameraCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  
  addCameraTitle: {
    fontSize: typography.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  
  cameraInput: {
    width: '100%',
    marginBottom: spacing.md,
  },
  
  linkCameraButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  
  cameraErrorText: {
    color: colors.error,
    fontSize: typography.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    width: '80%',
    maxHeight: '80%',
  },
  buttonRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  addAnotherContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
});

export default LiveFootage; 