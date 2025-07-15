const mongoose = require('mongoose');

const alarmEventSchema = new mongoose.Schema(
  {
    alarm_id: {
      type: String,
      required: true,
      index: true
    },
    partition: {
      type: Number,
      required: true
    },
    armed: {
      type: Boolean,
      required: true
    },
    timestamp: {
      type: String, // Keeping as string to match the existing format
      required: true
    }
  },
  { 
    collection: 'alarm_events', // Use the existing collection name
    timestamps: false // Don't add createdAt/updatedAt as this collection has its own timestamp format
  }
);

// Index for faster queries
alarmEventSchema.index({ alarm_id: 1, timestamp: -1 });
alarmEventSchema.index({ timestamp: -1 }); // For report queries
alarmEventSchema.index({ partition: 1 });
alarmEventSchema.index({ armed: 1 });

module.exports = mongoose.model('AlarmEvent', alarmEventSchema); 