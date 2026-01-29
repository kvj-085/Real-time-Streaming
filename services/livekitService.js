const { createTTSStream } = require('./ttsStream');
const { startTavusSession, endTavusSession } = require('./tavusService');

/**
 * Stream TTS chunks to both LiveKit (audio) and Tavus (avatar lip-sync).
 * 
 *   ARCHITECTURE:
 * - NO local TTS generation
 * - Send text directly to Tavus
 * - Tavus generates speech + lip-sync
 * - Return Tavus conversation URL
 */

let activeSessions = {}; // Track active Tavus sessions

async function streamTTSChunks(text, tavusEnabled = true) {
  const start = Date.now();
  let tavusSession = null;

  // Create Tavus session with text as custom greeting
  if (tavusEnabled) {
    console.log('[TTS Stream] Creating Tavus session with text...');
    try {
      tavusSession = await Promise.race([
        startTavusSession(`tts-${Date.now}`, text),
        new Promise(resolve => setTimeout(() => resolve({ disabled: true, timeout: true }), 8000)),
      ]);
      
      if (tavusSession && !tavusSession.disabled && !tavusSession.timeout) {
        activeSessions[tavusSession.sessionId] = true;
        console.log('[TTS Stream] ✓ Tavus session created - avatar will speak!');
        console.log(`[TTS Stream] Viewer URL: ${tavusSession.viewerUrl}`);
      } else {
        console.log('[TTS Stream] Tavus unavailable or timed out');
        tavusSession = null;
      }
    } catch (err) {
      console.log('[TTS Stream] Tavus error:', err.message);
      tavusSession = null;
    }
  }

  const totalTime = Date.now() - start;
  console.log(`[TTS Stream] Completed in ${totalTime}ms | Tavus: ${tavusSession ? 'active' : 'disabled'}`);

  return {
    chunks: [], // No audio chunks - Tavus handles TTS
    count: 0,
    elapsedMs: totalTime,
    tavusSession: tavusSession,
  };
}

async function shutdown() {
  console.log('[TTS Stream] Shutting down');
  
  // Close any active Tavus sessions
  for (const sessionId of Object.keys(activeSessions)) {
    try {
      await endTavusSession(sessionId);
      delete activeSessions[sessionId];
    } catch (err) {
      console.warn(`[TTS Stream] Error closing Tavus session:`, err.message);
    }
  }
}

module.exports = {
  streamTTSChunks,
  shutdown,
};
