/**
 * Real-time Streaming TTS Server (STEP 3)
 * 
 * Upgraded to integrate Tavus Persona API for avatar rendering.
 * Same audio stream powers both LiveKit audio and Tavus avatar lip-sync.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { speakHandler } = require('./routes/speak');
const { shutdown } = require('./services/livekitService');
const { testTavusConnection } = require('./services/tavusService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('public')); // Serve static frontend files

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.post('/speak', speakHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Real-time TTS Streaming API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Tavus connectivity test
app.get('/test-tavus', async (req, res) => {
  const connected = await testTavusConnection();
  res.json({
    tavus: connected ? 'connected' : 'failed',
    apiKey: process.env.TAVUS_API_KEY ? 'set' : 'missing',
    personaId: process.env.TAVUS_PERSONA_ID ? 'set' : 'missing',
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🎭 Real-time TTS + Tavus Avatar Server');
  console.log('='.repeat(60));
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Frontend available at: http://localhost:${PORT}`);
  console.log(`API endpoint: POST http://localhost:${PORT}/speak`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  console.log('Tavus integration: ' + (process.env.TAVUS_API_KEY ? '✓ Enabled' : '✗ Disabled'));
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received. Shutting down gracefully...');
  shutdown().finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\n\nSIGINT received. Shutting down gracefully...');
  shutdown().finally(() => process.exit(0));
});
