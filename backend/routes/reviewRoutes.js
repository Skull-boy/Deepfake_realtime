const express = require('express');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const FrameRecord = require('../models/FrameRecord');

const router = express.Router();

/**
 * All review routes are admin-only.
 * Middleware chain: requireAuth (Clerk) → requireRole(["admin"])
 */

// ──────────────────────────────────────
// GET /api/review/frames
// Paginated list of frames for review
// ──────────────────────────────────────
router.get('/frames', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const {
      status = 'all',     // 'pending' | 'reviewed' | 'all'
      session_id,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Filter by review status
    if (status === 'pending') {
      filter.human_label = null;
    } else if (status === 'reviewed') {
      filter.human_label = { $ne: null };
    }

    // Filter by session
    if (session_id) {
      filter.session_id = session_id;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const lim = parseInt(limit, 10);

    const [frames, total] = await Promise.all([
      FrameRecord.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      FrameRecord.countDocuments(filter),
    ]);

    res.json({
      frames,
      pagination: {
        page: parseInt(page, 10),
        limit: lim,
        total,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (error) {
    console.error('[REVIEW] Error fetching frames:', error);
    res.status(500).json({ error: 'Failed to fetch frames' });
  }
});

// ──────────────────────────────────────
// GET /api/review/sessions
// List unique session IDs for filtering
// ──────────────────────────────────────
router.get('/sessions', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const sessions = await FrameRecord.aggregate([
      {
        $group: {
          _id: '$session_id',
          frameCount: { $sum: 1 },
          firstFrame: { $min: '$timestamp' },
          lastFrame: { $max: '$timestamp' },
          reviewed: {
            $sum: { $cond: [{ $ne: ['$human_label', null] }, 1, 0] },
          },
        },
      },
      { $sort: { lastFrame: -1 } },
      { $limit: 50 },
    ]);

    res.json({
      sessions: sessions.map((s) => ({
        session_id: s._id,
        frame_count: s.frameCount,
        reviewed: s.reviewed,
        pending: s.frameCount - s.reviewed,
        first_frame: s.firstFrame,
        last_frame: s.lastFrame,
      })),
    });
  } catch (error) {
    console.error('[REVIEW] Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ──────────────────────────────────────
// POST /api/review/frames/:id/label
// Save human correction for a frame
// ──────────────────────────────────────
router.post('/frames/:id/label', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { human_label } = req.body;

    if (!['FAKE', 'REAL'].includes(human_label)) {
      return res.status(400).json({ error: 'human_label must be FAKE or REAL' });
    }

    // Get the reviewer's Clerk user ID from the auth context
    const reviewerId = req.auth?.userId || 'unknown';

    const updated = await FrameRecord.findByIdAndUpdate(
      id,
      {
        human_label,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Frame not found' });
    }

    res.json({
      message: 'Label saved',
      frame: {
        _id: updated._id,
        human_label: updated.human_label,
        reviewed_by: updated.reviewed_by,
        reviewed_at: updated.reviewed_at,
      },
    });
  } catch (error) {
    console.error('[REVIEW] Error saving label:', error);
    res.status(500).json({ error: 'Failed to save label' });
  }
});

// ──────────────────────────────────────
// GET /api/review/stats
// Review progress and training status
// ──────────────────────────────────────
router.get('/stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const [total, reviewed, pending, availableForTraining] = await Promise.all([
      FrameRecord.countDocuments({}),
      FrameRecord.countDocuments({ human_label: { $ne: null } }),
      FrameRecord.countDocuments({ human_label: null }),
      FrameRecord.countDocuments({ human_label: { $ne: null }, used_in_training: false }),
    ]);

    // Get AI server training status
    const aiServerUrl = process.env.AI_NGROK_URL || 'http://localhost:8000';
    let aiStatus = {};
    try {
      const aiRes = await fetch(`${aiServerUrl}/retrain/status`);
      if (aiRes.ok) {
        aiStatus = await aiRes.json();
      }
    } catch (e) {
      // AI server may be down — that's ok
      aiStatus = { cold_start: true, error: 'AI server unreachable' };
    }

    res.json({
      total_frames: total,
      reviewed,
      pending_review: pending,
      available_for_training: availableForTraining,
      min_frames_for_training: 50,
      ready_to_train: availableForTraining >= 50,
      ai_server: aiStatus,
    });
  } catch (error) {
    console.error('[REVIEW] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ──────────────────────────────────────
// POST /api/review/retrain
// Trigger retraining on AI server
// ──────────────────────────────────────
router.post('/retrain', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const aiServerUrl = process.env.AI_NGROK_URL || 'http://localhost:8000';
    const aiRes = await fetch(`${aiServerUrl}/retrain`, { method: 'POST' });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      return res.status(aiRes.status).json({ error: `AI server error: ${errorText}` });
    }

    const result = await aiRes.json();
    res.json(result);
  } catch (error) {
    console.error('[REVIEW] Error triggering retrain:', error);
    res.status(500).json({ error: 'Failed to trigger retraining' });
  }
});

// ──────────────────────────────────────
// POST /api/review/approve
// Approve and deploy retrained model
// ──────────────────────────────────────
router.post('/approve', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const aiServerUrl = process.env.AI_NGROK_URL || 'http://localhost:8000';
    const aiRes = await fetch(`${aiServerUrl}/retrain/approve`, { method: 'POST' });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      return res.status(aiRes.status).json({ error: `AI server error: ${errorText}` });
    }

    const result = await aiRes.json();
    res.json(result);
  } catch (error) {
    console.error('[REVIEW] Error approving model:', error);
    res.status(500).json({ error: 'Failed to approve model' });
  }
});

module.exports = router;
