const mongoose = require('mongoose');

/**
 * FrameRecord — stores prediction frames from live analysis sessions
 * for post-session human review and meta-classifier retraining.
 *
 * Documents are inserted by the Python AI server (via pymongo).
 * This Mongoose schema is used by the Node.js backend for reading
 * and updating records during the review process.
 */
const FrameRecordSchema = new mongoose.Schema({
  session_id: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  frame_url: {
    type: String,  // Supabase public URL
    required: true,
  },

  // Primary model output
  primary_label: {
    type: String,
    enum: ['FAKE', 'REAL', 'UNKNOWN'],
    required: true,
  },
  primary_confidence: {
    type: Number,
    min: 0,
    max: 1,
  },
  face_detected: {
    type: Boolean,
    default: true,
  },
  latency_ms: {
    type: Number,
  },

  // Face embedding (512-dim array — stored for retraining)
  embedding: {
    type: [Number],
    select: false,  // Don't include in queries by default (large field)
  },

  // Meta-classifier output
  trust_verdict: {
    type: String,
    enum: ['TRUSTED', 'UNTRUSTED', 'NEEDS_REVIEW'],
    default: 'TRUSTED',
  },
  trust_score: {
    type: Number,
    min: 0,
    max: 1,
  },

  // Human review fields — null until reviewed
  human_label: {
    type: String,
    enum: ['FAKE', 'REAL', null],
    default: null,
  },
  reviewed_by: {
    type: String,  // Clerk user ID of reviewer
    default: null,
  },
  reviewed_at: {
    type: Date,
    default: null,
  },

  // Training status
  used_in_training: {
    type: Boolean,
    default: false,
    index: true,
  },
});

// Compound index for efficient review queries
FrameRecordSchema.index({ human_label: 1, used_in_training: 1 });

module.exports = mongoose.model('FrameRecord', FrameRecordSchema, 'frame_records');
