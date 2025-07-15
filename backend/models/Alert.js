const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    camera_id: {
      type: String,
      required: true,
      default: 'webcam-01'
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    image_base64: {
      type: String,
      required: false // Optional snapshot
    },
    detection_type: {
      type: String,
      enum: ['gun', 'knife'],
      default: 'gun'
    },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active'
    }
  },
  { timestamps: true }
);

// Index for faster queries
alertSchema.index({ timestamp: -1 });
alertSchema.index({ camera_id: 1 });
alertSchema.index({ detection_type: 1 });
alertSchema.index({ status: 1 });
// Compound index for report queries
alertSchema.index({ timestamp: -1, detection_type: 1 });

module.exports = mongoose.model('Alert', alertSchema); 