const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema(
  {
    cameraId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    // Future fields such as location, createdBy, etc. can be added here
  },
  { timestamps: true }
);

module.exports = mongoose.model('Camera', cameraSchema); 