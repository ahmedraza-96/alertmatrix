const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    cameraId: {
      type: String,
      default: null,
    },
    hasLiveAccess: {
      type: Boolean,
      default: false,
    },
    associatedAlarms: [{
      alarm_id: {
        type: String,
        required: true
      },
      dateAssociated: {
        type: Date,
        default: Date.now
      }
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema); 