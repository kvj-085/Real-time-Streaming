const { createTTSStream } = require('./ttsStream');
const { startTavusSession, sendAudioToTavus, endTavusSession } = require('./tavusService');

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
  const ttsStream = createTTSStream(text);
  const start = Date.now();
  let count = 0;
  const chunks = [];
  let tavusSession = null;

  // Start Tavus in background - NEVER wait for it
  if (tavusEnabled) {
    startTavusSession(`tts-${Date.now()}`)
      .then(session => {
        if (session && !session.disabled) {
          tavusSession = session;
          activeSessions[session.sessionId] = true;
          console.log('[TTS Stream] Tavus connected in background');
        }
      })
      .catch(err => {
        console.log('[TTS Stream] Tavus failed, continuing audio-only');
      });
  }

  for await (const chunk of ttsStream) {
    count += 1;
    const timestamp = Date.now() - start;
    const base64 = chunk.toString('base64');
    chunks.push(base64);

    // Send to Tavus if session is active (non-blocking)
    if (tavusSession && !tavusSession.disabled) {
      sendAudioToTavus(tavusSession.sessionId, chunk, timestamp).catch(err =>
        console.warn(`[Tavus] Chunk ${count} failed:`, err.message)
      );
    }

    const elapsed = Date.now() - start;
    console.log(
      `[TTS Stream] Chunk ${count} | ${chunk.byteLength} bytes | ` +
      `elapsed=${elapsed}ms | tavus=${tavusSession ? 'active' : 'disabled'}`
    );
  }

  const totalTime = Date.now() - start;
  console.log(
    `[TTS Stream] Completed ${count} chunks in ${totalTime}ms | ` +
    `Tavus: ${tavusSession?.disabled ? 'disabled' : 'active'}`
  );

  return {
    chunks,
    count,
    elapsedMs: totalTime,
    tavusSession: tavusSession?.disabled ? null : tavusSession,
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
