require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const webhookRoutes = require('./routes/webhookRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const MediaAnalysis = require('./models/MediaAnalysis');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  dbName: 'deepfake'
})
.then(() => {
  console.log('MongoDB connected successfully');
  
  // Start the automated cleanup job for old media
  
  
  // Initialize Change Streams
  const changeStream = MediaAnalysis.watch();
  changeStream.on('change', (change) => {
    if (change.operationType === 'update') {
      const updatedFields = change.updateDescription.updatedFields;
      // Broadcast if status is completed or failed
      if (updatedFields && (updatedFields.status === 'completed' || updatedFields.status === 'failed')) {
         MediaAnalysis.findById(change.documentKey._id).then(doc => {
            if (doc) {
               console.log(`[ChangeStream] Document ${doc._id} changed to ${doc.status}. Broadcasting result...`);
               io.emit(`analysis_complete_${doc._id}`, doc);
            }
         });
      }
    }
  });
})
.catch((err) => console.error('MongoDB connection error:', err));

// Socket.io connection event
io.on('connection', (socket) => {
  console.log('Client connected to Socket.io:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Standard middleware — allow credentials for Clerk session cookies
const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      // If you are having CORS issues, temporarily change this to `callback(null, true)`
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'));
    }
  },
  credentials: true,
}));

// CRITICAL: Preserve raw body for Svix webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

// Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/upload', uploadRoutes);

const detectorRoutes = require('./routes/detectorRoutes');
app.use('/api/detect', detectorRoutes);

const reviewRoutes = require('./routes/reviewRoutes');
app.use('/api/review', reviewRoutes);

// General route
app.get('/', (req, res) => {
  res.send('Backend Server Running');
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});