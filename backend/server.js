// backend/server.js

// Core modules
const http = require('http');

// External deps
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

// Load env vars
dotenv.config();

const app = express();
const server = http.createServer(app);

// --- Socket.IO setup -------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);

// --- Express middleware ----------------------------------------------------
// Enhanced CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
  exposedHeaders: ['Content-Type', 'Content-Length'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '10mb' }));

// --- Database --------------------------------------------------------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ahmedrazaamjad101:i15mBUjLijMGxiN4@cluster0.czyj5cd.mongodb.net/alertmatrix?retryWrites=true&w=majority&appName=Cluster0';
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    setupAlarmEventWatcher();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });

// --- MongoDB Change Stream for Alarm Events -------------------------------
function setupAlarmEventWatcher() {
  try {
    const AlarmEvent = require('./models/AlarmEvent');
    
    // Create change stream to watch for new insertions
    const changeStream = AlarmEvent.watch([
      { $match: { operationType: 'insert' } }
    ], { fullDocument: 'updateLookup' });

    changeStream.on('change', (change) => {
      console.log('🚨 New alarm event detected:', change.fullDocument);
      
      const alarmData = change.fullDocument;
      const alarmPayload = {
        id: alarmData._id,
        alarm_id: alarmData.alarm_id,
        partition: alarmData.partition,
        armed: alarmData.armed,
        timestamp: alarmData.timestamp
      };

      // Broadcast to all connected clients
      io.emit('alarm_event', alarmPayload);
      
      console.log(`📢 Alarm event broadcasted: ${alarmData.alarm_id} - ${alarmData.armed ? 'ARMED' : 'DISARMED'}`);
    });

    changeStream.on('error', (error) => {
      console.error('❌ Change stream error:', error);
    });

    console.log('👀 Watching alarm_events collection for new insertions...');
  } catch (error) {
    console.error('❌ Error setting up alarm event watcher:', error);
  }
}

// --- Routes ----------------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/alert'));
app.use('/api/camera', require('./routes/camera'));
// Add reports route
app.use('/api/reports', require('./routes/report'));

app.get('/', (_, res) => {
  res.send({ status: 'OK', message: 'AlertMatrix backend is running' });
});

// --- Start server ----------------------------------------------------------
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server listening on ${HOST}:${PORT}`);
  console.log(`📱 Android emulator: http://10.0.2.2:${PORT}`);
  console.log(`🌐 Web browser: http://localhost:${PORT}`);
}); 