const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const Alert = require('../models/Alert');
const AlarmEvent = require('../models/AlarmEvent');

/**
 * Utility helpers ---------------------------------------------------------
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
}

function getISOWeek(date) {
  // https://stackoverflow.com/a/6117889/409081
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`; // e.g. 2024-W05
}

function getLabelByRange(date, range) {
  switch (range) {
    case 'weekly':
      return getISOWeek(date);
    case 'monthly':
      return formatMonth(date);
    case 'daily':
    default:
      return formatDate(date);
  }
}

/**
 * GET /api/reports
 * Query params:
 *   - range: daily (default) | weekly | monthly
 * Responds with:
 *   { data: [ { label, gunAlerts, knifeAlerts, alarmAlerts } ] }
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const range = (req.query.range || 'daily').toLowerCase();
    const now = new Date();
    
    console.log(`📊 Processing ${range} reports request`);
    const startTime = Date.now();

    // Check if user has camera or alarm access
    const User = require('../models/User');
    const user = await User.findById(req.user).select('cameraId hasLiveAccess associatedAlarms');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has at least one camera or alarm
    const hasCamera = user.hasLiveAccess && user.cameraId;
    const hasAlarm = user.associatedAlarms && user.associatedAlarms.length > 0;

    if (!hasCamera && !hasAlarm) {
      return res.json({
        data: [],
        message: 'Please add a camera or set up an alert to view reports.',
        hasAccess: false
      });
    }

    // Determine time window
    let startDate;
    switch (range) {
      case 'weekly':
        // Last 8 weeks
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7 * 8);
        break;
      case 'monthly':
        // Last 12 months
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setDate(1);
        break;
      case 'daily':
      default:
        // Last 7 days
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    // ----- Aggregate Alerts (gun / knife) using MongoDB aggregation ----
    console.log(`📊 Aggregating alerts for ${range} range from ${startDate}`);
    
    // Build alert filter - only include alerts from user's camera if they have one
    const alertFilter = { timestamp: { $gte: startDate } };
    if (hasCamera) {
      alertFilter.camera_id = user.cameraId;
    } else {
      // If user has no camera, don't include any alerts
      alertFilter.camera_id = null; // This will match no documents
    }
    
    const alertAggregation = await Promise.race([
      Alert.aggregate([
        { $match: alertFilter },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
              detection_type: "$detection_type"
            },
            count: { $sum: 1 }
          }
        }
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Alert aggregation timeout')), 25000)
      )
    ]);

    const dataMap = {};

    // Process alert aggregation results
    alertAggregation.forEach((result) => {
      const dateObj = new Date(result._id.date);
      const label = getLabelByRange(dateObj, range);
      if (!dataMap[label]) {
        dataMap[label] = { label, gunAlerts: 0, knifeAlerts: 0, alarmAlerts: 0 };
      }
      if (result._id.detection_type === 'knife') {
        dataMap[label].knifeAlerts += result.count;
      } else {
        dataMap[label].gunAlerts += result.count;
      }
    });

    // ----- Aggregate Alarm Events using MongoDB aggregation -------------
    console.log(`📊 Aggregating alarm events for ${range} range from ${startDate}`);
    
    // Build alarm filter - only include alarms from user's associated alarms
    const userAlarmIds = hasAlarm ? user.associatedAlarms.map(alarm => alarm.alarm_id) : [];
    
    // Since AlarmEvent timestamps are stored as strings, we need to convert them
    const alarmAggregation = await Promise.race([
      AlarmEvent.aggregate([
        {
          $addFields: {
            parsedTimestamp: {
              $dateFromString: {
                dateString: "$timestamp",
                onError: null
              }
            }
          }
        },
        { 
          $match: { 
            parsedTimestamp: { 
              $gte: startDate,
              $ne: null 
            },
            ...(hasAlarm ? { alarm_id: { $in: userAlarmIds } } : { alarm_id: null })
          } 
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$parsedTimestamp" } },
            count: { $sum: 1 }
          }
        }
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Alarm aggregation timeout')), 25000)
      )
    ]);

    // Process alarm aggregation results
    alarmAggregation.forEach((result) => {
      const dateObj = new Date(result._id);
      const label = getLabelByRange(dateObj, range);
      if (!dataMap[label]) {
        dataMap[label] = { label, gunAlerts: 0, knifeAlerts: 0, alarmAlerts: 0 };
      }
      dataMap[label].alarmAlerts += result.count;
    });

    // Convert map → sorted array (ascending by date/week/month)
    const dataArray = Object.values(dataMap).sort((a, b) => {
      return a.label < b.label ? -1 : 1;
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ ${range} reports completed in ${processingTime}ms, returning ${dataArray.length} entries`);

    res.json({ 
      data: dataArray,
      hasAccess: true,
      hasCamera,
      hasAlarm
    });
  } catch (error) {
    console.error(`❌ Error generating ${range} reports:`, error);
    res.status(500).json({ 
      message: 'Server error generating reports', 
      error: error.message,
      range: range
    });
  }
});

module.exports = router; 