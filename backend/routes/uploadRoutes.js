const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const MediaAnalysis = require('../models/MediaAnalysis');

const router = express.Router();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET_NAME || 'deepfake-media';

const supabase = createClient(supabaseUrl, supabaseKey);

// Use memory storage for Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/', upload.array('media', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      // Fallback for single file upload just in case
      if (req.file && req.file.buffer) {
        req.files = [req.file];
      } else {
        return res.status(400).json({ error: 'No media uploaded.' });
      }
    }

    const aiNgrokUrl = process.env.AI_NGROK_URL;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const results = [];

    for (const file of req.files) {
      // Determine media type based on mimetype
      const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
      const extension = file.originalname.split('.').pop();
      const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

      // Upload to Supabase bucket
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from(supabaseBucket)
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase upload error for', file.originalname, ':', uploadError);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase
        .storage
        .from(supabaseBucket)
        .getPublicUrl(uniqueFileName);
      
      const publicUrl = urlData.publicUrl;

      // Create MongoDB Document
      const mediaAnalysis = new MediaAnalysis({
        mediaType: mediaType,
        fileUrl: publicUrl,
        status: 'processing'
      });

      await mediaAnalysis.save();

      console.log(`[Upload] Document created: ${mediaAnalysis._id}.`);
      results.push({ documentId: mediaAnalysis._id.toString(), filename: file.originalname });

      // Ping Computer B only if AI_NGROK_URL is configured
      if (aiNgrokUrl) {
        fetch(`${aiNgrokUrl}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            documentId: mediaAnalysis._id.toString(),
            fileUrl: publicUrl,
            mediaType: mediaType,
            callbackUrl: `${backendUrl}/api/upload/result`
          }),
        })
        .then(response => {
          if (!response.ok) {
            console.error('[Upload] Computer B async ping failed with status:', response.status);
          } else {
            console.log(`[Upload] Computer B triggered for ${mediaAnalysis._id}`);
          }
        })
        .catch(err => console.error('[Upload] Error pinging Computer B:', err));
      } else {
        console.warn('[Upload] AI_NGROK_URL not set — skipping Computer B trigger.');
      }
    }

    if (results.length === 0) {
       return res.status(500).json({ error: 'Failed to upload media to storage.' });
    }

    // Instantly respond to the frontend with the document IDs
    // Return the first documentId as documentId for backward compatibility, and documentIds array
    return res.json({ 
      documentId: results[0].documentId,
      documentIds: results.map(r => r.documentId),
      files: results
    });

  } catch (error) {
    console.error('Error in upload route:', error);
    return res.status(500).json({ error: 'Failed to process upload request.' });
  }
});

// Endpoint to receive the processed result from the AI server
router.post('/result', async (req, res) => {
  try {
    const { documentId, result } = req.body;
    if (!documentId || !result) {
      return res.status(400).json({ error: 'Missing documentId or result' });
    }
    
    let status = 'completed';
    if (result.error) {
       status = 'failed';
    }

    const mediaAnalysis = await MediaAnalysis.findByIdAndUpdate(
      documentId,
      {
        status: status,
        result: {
          label: result.label || 'UNKNOWN',
          confidence: result.confidence || 0,
          error: result.error || null
        }
      },
      { new: true }
    );
    
    if (!mediaAnalysis) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    console.log(`[Result Callback] Document ${documentId} updated successfully.`);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error in /result callback:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
