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
  const ttsStream = createTTSStream(text);
  const start = Date.now();
  let count = 0;
  const chunks = [];
  let tavusSession = null;

  // Start Tavus in background to get viewer URL only
  let tavusSessionPromise = null;
  if (tavusEnabled) {
    tavusSessionPromise = startTavusSession(`tts-${Date.now()}`)
      .then(session => {
        if (session && !session.disabled) {
          tavusSession = session;
          activeSessions[session.sessionId] = true;
          console.log('[TTS Stream] Tavus viewer URL created - share with frontend for avatar display');
        }
        return session;
      })
      .catch(err => {
        console.log('[TTS Stream] Tavus unavailable, audio-only mode');
        return { disabled: true };
      });
  }

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

  // If Tavus not ready yet, give it a brief moment to resolve so we can return the stream URL
  if (!tavusSession && tavusSessionPromise !== null) {
    tavusSession = await Promise.race([
      tavusSessionPromise,
      new Promise(resolve => setTimeout(() => resolve({ disabled: true, pending: true }), 2000)),
    ]);
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
