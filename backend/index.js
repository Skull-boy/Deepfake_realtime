require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => console.error('MongoDB connection error:', err));

// Standard middleware
app.use(cors());

// CRITICAL: Preserve raw body for Svix webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

// Routes
app.use('/api/webhooks', webhookRoutes);

const detectorRoutes = require('./routes/detectorRoutes');
app.use('/api/detect', detectorRoutes);

// General route
app.get('/', (req, res) => {
  res.send('Backend Server Running');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
