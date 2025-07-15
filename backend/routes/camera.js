const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Camera = require('../models/Camera');
const User = require('../models/User');

/**
 * @route   POST /api/camera/register
 * @desc    Register a new camera ID if it does not already exist
 * @access  Public (typically called by the detection service on startup)
 */
router.post('/register', async (req, res) => {
  try {
    const { cameraId, description = '' } = req.body;

    if (!cameraId) {
      return res.status(400).json({ success: false, message: 'cameraId is required' });
    }

    let camera = await Camera.findOne({ cameraId });
    if (!camera) {
      camera = await Camera.create({ cameraId, description });
      console.log(`📷 New camera registered: ${cameraId}`);
    }

    return res.status(200).json({ success: true, camera });
  } catch (error) {
    console.error('Error registering camera:', error);
    return res.status(500).json({ success: false, message: 'Server error registering camera' });
  }
});

/**
 * @route   POST /api/camera/link
 * @desc    Verify camera ID and link it to the authenticated user
 * @access  Private
 */
router.post('/link', auth, async (req, res) => {
  try {
    const { cameraId } = req.body;

    if (!cameraId) {
      return res.status(400).json({ success: false, message: 'cameraId is required' });
    }

    const camera = await Camera.findOne({ cameraId });
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Invalid Camera ID' });
    }

    // Update user document
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.cameraId = cameraId;
    user.hasLiveAccess = true;
    await user.save();

    return res.status(200).json({ success: true, message: 'Access granted', user: { id: user._id, cameraId, hasLiveAccess: true } });
  } catch (error) {
    console.error('Error linking camera to user:', error);
    return res.status(500).json({ success: false, message: 'Server error linking camera' });
  }
});

/**
 * @route   GET /api/camera/access
 * @desc    Get live access status for the authenticated user
 * @access  Private
 */
router.get('/access', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('cameraId hasLiveAccess');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, cameraId: user.cameraId, hasLiveAccess: user.hasLiveAccess });
  } catch (error) {
    console.error('Error fetching access status:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 