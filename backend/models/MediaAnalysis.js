const mongoose = require('mongoose');

const MediaAnalysisSchema = new mongoose.Schema({
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true,
  },
  fileUrl: {
    type: String, // Public Supabase URL
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  result: {
    label: {
      type: String,
      default: null,
    },
    confidence: {
      type: Number,
      default: null,
    },
    error: {
      type: String,
      default: null,
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('MediaAnalysis', MediaAnalysisSchema);
