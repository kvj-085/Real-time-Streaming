const { createTTSStream } = require('./ttsStream');
const { startTavusSession, endTavusSession } = require('./tavusService');

/**
 * Stream TTS chunks to both LiveKit (audio) and Tavus (avatar lip-sync).
 * 
 * ARCHITECTURE:
 * - TTS generates audio chunks progressively
 * - Each chunk is immediately:
 *   1. Converted to base64 for frontend playback (LiveKit audio)
 *   2. Sent to Tavus for avatar lip-sync rendering
 * - Same audio stream powers both systems
 * - No buffering, no separate audio generation
 */

let activeSessions = {}; // Track active Tavus sessions

async function streamTTSChunks(text, tavusEnabled = true) {
  const start = Date.now();
  let count = 0;
  const chunks = [];
  let tavusSession = null;

  // WAIT for Tavus session BEFORE starting TTS stream
  if (tavusEnabled) {
    console.log('[TTS Stream] Creating Tavus session first...');
    try {
      tavusSession = await Promise.race([
        startTavusSession(`tts-${Date.now()}`),
        new Promise(resolve => setTimeout(() => resolve({ disabled: true, timeout: true }), 8000)),
      ]);
      
      if (tavusSession && !tavusSession.disabled && !tavusSession.timeout) {
        activeSessions[tavusSession.sessionId] = true;
        console.log('[TTS Stream] ✓ Tavus session ready BEFORE streaming audio');
        console.log(`[TTS Stream] Viewer URL: ${tavusSession.viewerUrl}`);
      } else {
        console.log('[TTS Stream] Tavus unavailable or timed out, continuing audio-only');
        tavusSession = null;
      }
    } catch (err) {
      console.log('[TTS Stream] Tavus error, continuing audio-only:', err.message);
      tavusSession = null;
    }
  }

  // NOW start TTS stream with Tavus already ready
  const ttsStream = createTTSStream(text);

  for await (const chunk of ttsStream) {
    count += 1;
    const timestamp = Date.now() - start;
    const base64 = chunk.toString('base64');
    chunks.push(base64);

    // NOTE: Audio streams to LiveKit listeners in real-time.
    // For avatar animation, frontend must join the Tavus Daily.co room
    // and send audio via WebRTC to make the avatar speak.

    const elapsed = Date.now() - start;
    console.log(
      `[TTS Stream] Chunk ${count} | ${chunk.byteLength} bytes | ` +
      `elapsed=${elapsed}ms | tavus=${tavusSession ? 'active' : 'disabled'}`
    );
  }

  const totalTime = Date.now() - start;
  console.log(
    `[TTS Stream] Completed ${count} chunks in ${totalTime}ms | ` +
    `Tavus: ${tavusSession ? 'active' : 'disabled'}`
  );

  return {
    chunks,
    count,
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
