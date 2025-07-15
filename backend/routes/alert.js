const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Alert = require('../models/Alert');
const AlarmEvent = require('../models/AlarmEvent');
const User = require('../models/User');
const fetch = require('node-fetch');

// @route   GET /api/video-stream
// @desc    Proxy video stream from YOLO service to avoid CORS issues
// @access  Public
router.get('/video-stream', async (req, res) => {
  try {
    const yoloServiceUrl = process.env.YOLO_SERVICE_URL || 'http://localhost:5000';
    const streamUrl = `${yoloServiceUrl}/video_feed`;
    
    // Check if YOLO service is available
    let serviceResponse;
    try {
      serviceResponse = await fetch(streamUrl, {
        method: 'GET',
        timeout: 30000, // Increased timeout for video streams
        headers: {
          'Accept': 'multipart/x-mixed-replace, */*',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!serviceResponse.ok) {
        throw new Error(`YOLO service returned ${serviceResponse.status}`);
      }
    } catch (error) {
      console.error('YOLO service not available:', error.message);
      return res.status(503).json({
        success: false,
        message: 'Video service is currently offline. Please start the YOLO detection service.',
        error: 'SERVICE_UNAVAILABLE'
      });
    }

    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Pipe the video stream directly to the response
    serviceResponse.body.pipe(res);
    
    // Handle stream errors
    serviceResponse.body.on('error', (error) => {
      console.error('Video stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Video stream error',
          error: error.message
        });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from video stream');
      if (serviceResponse.body) {
        serviceResponse.body.destroy();
      }
    });

  } catch (error) {
    console.error('Error setting up video stream proxy:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to set up video stream',
        error: error.message
      });
    }
  }
});

// @route   POST /api/alert
// @desc    Receive alert from YOLO service and broadcast via WebSockets
// @access  Public (YOLO script access)
router.post('/alert', async (req, res) => {
  try {
    const { camera_id, timestamp, confidence, image_base64, detection_type } = req.body;

    if (!camera_id || !timestamp || confidence == null) {
      return res.status(400).json({ message: 'Missing required fields: camera_id, timestamp, confidence' });
    }

    // Create alert in database
    const alert = new Alert({
      camera_id,
      timestamp: new Date(timestamp),
      confidence,
      image_base64: image_base64 || null,
      detection_type: detection_type || 'gun'
    });

    await alert.save();

    const alertPayload = {
      id: alert._id,
      camera_id: alert.camera_id,
      timestamp: alert.timestamp,
      confidence: alert.confidence,
      detection_type: alert.detection_type,
      image_base64: alert.image_base64
    };

    // Broadcast to connected clients - different events for different weapon types
    const eventName = detection_type === 'knife' ? 'knife_alert' : 'gun_alert';
    req.app.get('io').emit(eventName, alertPayload);

    console.log(`🚨 Alert saved and broadcasted: ${detection_type} detected with ${Math.round(confidence * 100)}% confidence`);

    return res.status(200).json({ 
      message: 'Alert received and stored', 
      data: alertPayload 
    });
  } catch (error) {
    console.error('Error processing alert:', error);
    return res.status(500).json({ message: 'Server error processing alert' });
  }
});

// @route   GET /api/video-stream-url
// @desc    Get video stream URL from YOLO service with quality options
// @access  Public (for mobile app)
router.get('/video-stream-url', async (req, res) => {
  try {
    const { quality = 'auto' } = req.query;
    const yoloServiceUrl = process.env.YOLO_SERVICE_URL || 'http://localhost:5000';
    
    // Check if YOLO service is running
    let serviceOnline = false;
    try {
      const healthResponse = await fetch(`${yoloServiceUrl}/api/status`, {
        timeout: 10000, // Increased timeout for status check
        headers: {
          'Accept': 'application/json'
        }
      });
      serviceOnline = healthResponse.ok;
    } catch (error) {
      console.log('YOLO service health check failed:', error.message);
      serviceOnline = false;
    }

    // Use backend proxy URL to avoid CORS issues
    let streamUrl;
    let streamType = 'mjpeg';
    
    if (serviceOnline) {
      // Use the backend proxy endpoint instead of direct YOLO service
      const backendHost = req.headers.host || 'localhost:4000';
      streamUrl = `http://${backendHost}/api/video-stream`;
      
      // For quality parameter, we'll pass it through (can be implemented later in proxy)
      if (quality && quality !== 'auto') {
        streamUrl += `?quality=${quality}`;
      }
    } else {
      // Fallback: provide a placeholder URL or indicate service is offline
      streamUrl = null; // This will trigger the fallback UI in the mobile app
    }
    
    // Get client IP to determine if we need to adjust URLs for mobile
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const isMobileRequest = req.headers['user-agent']?.includes('Expo') || 
                           req.headers['user-agent']?.includes('Android') ||
                           req.headers['user-agent']?.includes('iPhone');
    
    // For mobile clients, ensure we're not using localhost in URLs
    if (isMobileRequest && streamUrl && streamUrl.includes('localhost')) {
      // Replace localhost with 10.0.2.2 for Android emulator or actual IP for real devices
      streamUrl = streamUrl.replace('localhost', '10.0.2.2');
    }

    res.json({
      success: serviceOnline, // Only return success if service is actually online
      streamUrl: serviceOnline ? streamUrl : null,
      streamType: serviceOnline ? streamType : null,
      quality,
      serviceOnline,
      message: serviceOnline 
        ? 'Video stream URL retrieved successfully' 
        : 'Video service is currently offline. Please start the video service and try again.',
      alternativeStreams: serviceOnline ? {
        mjpeg: `http://${req.headers.host || 'localhost:4000'}/api/video-stream`,
        direct: `${yoloServiceUrl}/video_feed`,
      } : null,
      // Add info to help debug mobile connectivity issues
      debug: {
        isMobileRequest,
        clientIP: clientIP?.replace('::ffff:', ''),
        serverHost: req.headers.host
      }
    });
  } catch (error) {
    console.error('Error getting video stream URL:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get video stream URL',
      error: error.message
    });
  }
});

// @route   GET /api/detection-status
// @desc    Get current detection service status with enhanced info
// @access  Public
router.get('/detection-status', async (req, res) => {
  try {
    const yoloServiceUrl = process.env.YOLO_SERVICE_URL || 'http://localhost:5000';
    
    let serviceStatus = 'inactive';
    let serviceInfo = null;
    let lastAlert = null;
    let totalAlerts = 0;
    
    // Try to ping the YOLO service and get detailed status
    try {
      const response = await fetch(`${yoloServiceUrl}/api/status`, {
        timeout: 5000,
      });
      
      if (response.ok) {
        serviceStatus = 'active';
        try {
          serviceInfo = await response.json();
        } catch (e) {
          // Service is running but doesn't return JSON status
          serviceInfo = { status: 'active' };
        }
      }
    } catch (error) {
      console.log('Detection service status check failed:', error.message);
      serviceStatus = 'inactive';
    }
    
    // Get the most recent alert
    const recentAlert = await Alert.findOne().sort({ timestamp: -1 });
    if (recentAlert) {
      lastAlert = {
        id: recentAlert._id,
        timestamp: recentAlert.timestamp,
        detection_type: recentAlert.detection_type,
        confidence: recentAlert.confidence,
        camera_id: recentAlert.camera_id
      };
    }

    // Get total alerts count
    totalAlerts = await Alert.countDocuments();

    // Get alerts from last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlertsCount = await Alert.countDocuments({
      timestamp: { $gte: last24Hours }
    });

    res.json({
      success: true,
      status: serviceStatus,
      serviceInfo,
      lastAlert,
      totalAlerts,
      recentAlertsCount,
      yoloServiceUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting detection status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get detection status',
      error: error.message
    });
  }
});

// @route   GET /api/stream-health
// @desc    Check stream health and provide diagnostics
// @access  Public
router.get('/stream-health', async (req, res) => {
  try {
    const yoloServiceUrl = process.env.YOLO_SERVICE_URL || 'http://localhost:5000';
    const checks = [];

    // Check YOLO service main endpoint
    try {
      const startTime = Date.now();
      const response = await fetch(`${yoloServiceUrl}/api/status`, {
        timeout: 5000,
      });
      const responseTime = Date.now() - startTime;
      
      checks.push({
        name: 'YOLO Service Status',
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: `${responseTime}ms`,
        details: response.ok ? 'Service responding' : `HTTP ${response.status}`
      });
    } catch (error) {
      checks.push({
        name: 'YOLO Service Status',
        status: 'error',
        responseTime: 'timeout',
        details: error.message
      });
    }

    // Check video stream endpoint
    try {
      const startTime = Date.now();
      const response = await fetch(`${yoloServiceUrl}/video_feed`, {
        method: 'HEAD',
        timeout: 5000,
      });
      const responseTime = Date.now() - startTime;
      
      checks.push({
        name: 'Video Stream',
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: `${responseTime}ms`,
        details: response.ok ? 'Stream available' : `HTTP ${response.status}`
      });
    } catch (error) {
      checks.push({
        name: 'Video Stream',
        status: 'error',
        responseTime: 'timeout',
        details: error.message
      });
    }

    // Check database connectivity
    try {
      await Alert.findOne().limit(1);
      checks.push({
        name: 'Database',
        status: 'healthy',
        details: 'Connected'
      });
    } catch (error) {
      checks.push({
        name: 'Database',
        status: 'error',
        details: error.message
      });
    }

    const overallHealth = checks.every(check => check.status === 'healthy') ? 'healthy' : 'degraded';

    res.json({
      success: true,
      overallHealth,
      checks,
      timestamp: new Date().toISOString(),
      recommendations: generateHealthRecommendations(checks)
    });

  } catch (error) {
    console.error('Error checking stream health:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check stream health',
      error: error.message
    });
  }
});

// Helper function to generate health recommendations
function generateHealthRecommendations(checks) {
  const recommendations = [];
  
  const yoloCheck = checks.find(c => c.name === 'YOLO Service Status');
  if (yoloCheck && yoloCheck.status !== 'healthy') {
    recommendations.push('Start the YOLO detection service on port 5000');
    recommendations.push('Ensure Python dependencies are installed');
  }

  const streamCheck = checks.find(c => c.name === 'Video Stream');
  if (streamCheck && streamCheck.status !== 'healthy') {
    recommendations.push('Check camera connection and permissions');
    recommendations.push('Verify video stream endpoint configuration');
  }

  const dbCheck = checks.find(c => c.name === 'Database');
  if (dbCheck && dbCheck.status !== 'healthy') {
    recommendations.push('Check MongoDB connection string');
    recommendations.push('Ensure database server is running');
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems are running normally');
  }

  return recommendations;
}

// @route   GET /api/alerts
// @desc    Get alerts for authenticated user
// @access  Private
router.get('/alerts', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, camera_id, detection_type } = req.query;
    
    // Get user's camera ID
    const user = await User.findById(req.user).select('cameraId hasLiveAccess');
    if (!user || !user.hasLiveAccess || !user.cameraId) {
      return res.json({
        alerts: [],
        totalPages: 0,
        currentPage: page,
        total: 0
      });
    }
    
    // Build filter - only show alerts from user's camera
    const filter = { camera_id: user.cameraId };
    if (status) filter.status = status;
    if (camera_id) filter.camera_id = camera_id; // Allow override if specified
    if (detection_type) filter.detection_type = detection_type;

    const alerts = await Alert.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-image_base64'); // Exclude base64 images for list view

    const total = await Alert.countDocuments(filter);

    res.json({
      alerts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Server error fetching alerts' });
  }
});

// @route   GET /api/alerts/:id
// @desc    Get single alert with image
// @access  Private
router.get('/alerts/:id', auth, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    res.json(alert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ message: 'Server error fetching alert' });
  }
});

// @route   PATCH /api/alerts/:id
// @desc    Update alert status
// @access  Private
router.patch('/alerts/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'acknowledged', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ message: 'Server error updating alert' });
  }
});

// ===== ALARM MANAGEMENT ROUTES =====

// Simple test route
router.get('/alarms/test', (req, res) => {
  res.json({ success: true, message: 'Alarm routes working!' });
});

// Validate alarm ID
router.post('/alarms/validate', auth, async (req, res) => {
  try {
    const { alarm_id } = req.body;
    if (!alarm_id) {
      return res.status(400).json({ success: false, message: 'Alarm ID is required' });
    }

    const alarmExists = await AlarmEvent.findOne({ alarm_id });
    if (!alarmExists) {
      return res.status(404).json({ success: false, message: 'Invalid Alarm ID. This alarm does not exist.' });
    }

    res.json({ 
      success: true, 
      message: 'Alarm ID is valid',
      alarm: { alarm_id: alarmExists.alarm_id, partition: alarmExists.partition, armed: alarmExists.armed }
    });
  } catch (error) {
    console.error('Error validating alarm ID:', error);
    res.status(500).json({ success: false, message: 'Server error validating alarm ID' });
  }
});

// @route   POST /api/alarms/new-event
// @desc    Create new alarm event and broadcast to connected clients
// @access  Public (for external alarm system)
router.post('/alarms/new-event', async (req, res) => {
  try {
    const { alarm_id, partition, armed, timestamp } = req.body;

    if (!alarm_id || partition == null || armed == null || !timestamp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: alarm_id, partition, armed, timestamp' 
      });
    }

    // Create new alarm event
    const alarmEvent = new AlarmEvent({
      alarm_id,
      partition,
      armed,
      timestamp
    });

    await alarmEvent.save();

    const alarmPayload = {
      id: alarmEvent._id,
      alarm_id: alarmEvent.alarm_id,
      partition: alarmEvent.partition,
      armed: alarmEvent.armed,
      timestamp: alarmEvent.timestamp
    };

    // Broadcast to connected clients
    req.app.get('io').emit('alarm_event', alarmPayload);

    console.log(`🚨 Alarm event saved and broadcasted: ${alarm_id} - ${armed ? 'ARMED' : 'DISARMED'}`);

    return res.status(200).json({ 
      success: true,
      message: 'Alarm event created and broadcasted', 
      data: alarmPayload 
    });
  } catch (error) {
    console.error('Error creating alarm event:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error creating alarm event' 
    });
  }
});

// Associate alarm with user
router.post('/alarms/associate', auth, async (req, res) => {
  console.log('🔔 Association endpoint called!');
  try {
    const { alarm_id } = req.body;
    const userId = req.user;

    if (!alarm_id) {
      return res.status(400).json({ success: false, message: 'Alarm ID is required' });
    }

    const alarmExists = await AlarmEvent.findOne({ alarm_id });
    if (!alarmExists) {
      return res.status(404).json({ success: false, message: 'Invalid Alarm ID. This alarm does not exist.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const alarmAlreadyAssociated = user.associatedAlarms.some(alarm => alarm.alarm_id === alarm_id);
    if (alarmAlreadyAssociated) {
      return res.status(400).json({ success: false, message: 'This alarm is already associated with your account.' });
    }

    user.associatedAlarms.push({ alarm_id, dateAssociated: new Date() });
    await user.save();

    res.json({ 
      success: true, 
      message: 'Alarm successfully associated with your account',
      alarm: { alarm_id, dateAssociated: new Date() }
    });
  } catch (error) {
    console.error('Error associating alarm:', error);
    res.status(500).json({ success: false, message: 'Server error associating alarm' });
  }
});

// @route   GET /api/alarms/user-alarms
// @desc    Get all alarm notifications for the current user's associated alarms
// @access  Private
router.get('/alarms/user-alarms', auth, async (req, res) => {
  try {
    const userId = req.user;
    const { page = 1, limit = 20 } = req.query;

    // Get the user and their associated alarms
    const user = await User.findById(userId).select('associatedAlarms');
    if (!user || !user.associatedAlarms.length) {
      return res.json({ 
        success: true,
        alarmNotifications: [],
        associatedAlarms: [],
        totalPages: 0,
        currentPage: page,
        total: 0,
        message: 'No alarms associated with your account'
      });
    }

    // Extract alarm IDs
    const alarmIds = user.associatedAlarms.map(alarm => alarm.alarm_id);

    // Get alarm notifications for user's associated alarms
    const alarmNotifications = await AlarmEvent.find({ 
      alarm_id: { $in: alarmIds } 
    })
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AlarmEvent.countDocuments({ 
      alarm_id: { $in: alarmIds } 
    });

    res.json({
      success: true,
      alarmNotifications,
      associatedAlarms: user.associatedAlarms,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching user alarms:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching alarm notifications' 
    });
  }
});

// @route   DELETE /api/alarms/disassociate
// @desc    Remove an alarm association from the current user
// @access  Private
router.delete('/alarms/disassociate', auth, async (req, res) => {
  try {
    const { alarm_id } = req.body;
    const userId = req.user;

    if (!alarm_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Alarm ID is required' 
      });
    }

    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Remove alarm from user's associated alarms
    const initialLength = user.associatedAlarms.length;
    user.associatedAlarms = user.associatedAlarms.filter(
      alarm => alarm.alarm_id !== alarm_id
    );

    if (user.associatedAlarms.length === initialLength) {
      return res.status(404).json({ 
        success: false, 
        message: 'Alarm not found in your associated alarms' 
      });
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Alarm successfully removed from your account' 
    });

  } catch (error) {
    console.error('Error disassociating alarm:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error removing alarm association' 
    });
  }
});

// Debug: Log when alarm routes are loaded
console.log('✅ Alarm management routes loaded:', [
  'POST /api/alarms/validate',
  'POST /api/alarms/associate', 
  'GET /api/alarms/user-alarms',
  'DELETE /api/alarms/disassociate'
]);

// Add a simple health check for alarm routes
router.get('/alarms/health', (req, res) => {
  console.log('🏥 Alarm health check called');
  res.json({ 
    success: true, 
    message: 'Alarm routes are healthy',
    routes: [
      'POST /api/alarms/validate',
      'POST /api/alarms/associate',
      'GET /api/alarms/user-alarms', 
      'DELETE /api/alarms/disassociate'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 