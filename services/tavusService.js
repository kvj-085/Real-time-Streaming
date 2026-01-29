/**
 * Tavus Persona Service
 *
 * Integrates with Tavus API for real-time avatar rendering.
 *
 * HOW TAVUS USES AUDIO FOR LIP SYNC:
 * Tavus analyzes audio stream in real-time to sync avatar mouth movements
 * with speech. By sending audio chunks as we generate them, Tavus can:
 * - Process audio incrementally
 * - Sync lip movements with minimal latency
 * - Create responsive, natural-looking avatar expressions
 *
 * WHY WE SEND THE SAME STREAM TO BOTH SYSTEMS:
 * - LiveKit: handles audio playback for listeners
 * - Tavus: uses audio for avatar lip-sync and expression analysis
 * - Same source ensures audio/video sync is perfect
 * - No separate audio generation or buffering needed
 */

const fetch = require('node-fetch');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_PERSONA_ID = process.env.TAVUS_PERSONA_ID;
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID;
const TAVUS_API_BASE = process.env.TAVUS_API_BASE;

/**
 * Start a Tavus streaming session
 * Creates a conversation where the avatar will speak the provided text
 *
 * @param {string} sessionName - Unique name for this session
 * @param {string} textToSpeak - The text for the avatar to speak
 * @returns {Promise<Object>} Session info with video stream URL
 */
async function startTavusSession(sessionName, textToSpeak = null) {
  if (!TAVUS_API_KEY || !TAVUS_PERSONA_ID || !TAVUS_REPLICA_ID) {
    console.warn('[Tavus] API key, persona ID, or replica ID missing. Tavus disabled.');
    return { disabled: true };
  }

  try {
    const endpoint = `${TAVUS_API_BASE}/conversations`;
    
    console.log(`[Tavus] Creating conversation at: ${endpoint}`);
    if (textToSpeak) {
      console.log(`[Tavus] Avatar will speak: "${textToSpeak}"`);
    }
    
    const requestBody = {
      replica_id: TAVUS_REPLICA_ID,
      persona_id: TAVUS_PERSONA_ID,
    };
    
    // If text provided, use it as custom greeting
    if (textToSpeak) {
      requestBody.custom_greeting = textToSpeak;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY,
      },
      body: JSON.stringify(requestBody),
      timeout: 15000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tavus] API error response: ${errorText}`);
      throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
    }

    const session = await response.json();
    const conversationId = session.conversation_id || session.id;
    // Prefer API-provided stream_url; fall back to constructed daily URL
    const streamUrl = session.stream_url || `https://tavus.daily.co/${conversationId}/stream.m3u8`;
    
    console.log(`[Tavus] Conversation created: ${conversationId}`);
    console.log(`[Tavus] Stream URL: ${streamUrl}`);
    console.log(`[Tavus] Viewer URL: ${session.conversation_url}`);
    console.log(`[Tavus] Session keys: ${Object.keys(session).join(', ')}`);
    
    // NOTE: Tavus avatars are powered by Daily.co WebRTC rooms.
    // To send audio from the server, we need a WebRTC implementation or client-side bridge.
    // For now, return the viewer URL and audio will be streamed to LiveKit listeners.
    // The avatar can be viewed but will remain silent server-side.
    console.log(`[Tavus] ℹ️  Avatar viewer URL created - clients can watch and provide audio via WebRTC`);

    return {
      sessionId: conversationId,
      streamUrl: streamUrl,
      viewerUrl: session.conversation_url,
      disabled: false,
      audioDisabled: true, // Server-side audio injection not supported without WebRTC libs
    };
  } catch (error) {
    console.error('[Tavus] Failed to start conversation:', error.message);
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('[Tavus] Network error - check API endpoint and connectivity');
    }
    return { disabled: true };
  }
}

/**
 * Send audio chunk to Tavus avatar
 * NOTE: Current implementation streams to LiveKit only.
 * For avatar audio, frontend must join the Daily.co room and provide audio via WebRTC.
 *
 * @param {string} sessionId - Tavus session ID
 * @param {Buffer} audioChunk - Raw PCM16 audio chunk
 * @param {number} timestamp - Timing info in ms
 * @returns {Promise<void>}
 */
async function sendAudioToTavus(sessionId, audioChunk, timestamp) {
  if (!sessionId) {
    return;
  }

  // Current implementation: audio streams to LiveKit listeners only
  // Frontend can optionally join the Tavus room to make the avatar speak
  // by sending the same audio stream via WebRTC
}

/**
 * End Tavus session
 * Closes the conversation and cleans up resources
 *
 * @param {string} sessionId - Session to close
 */
async function endTavusSession(sessionId) {
  if (!TAVUS_API_KEY || !sessionId) {
    return;
  }

  try {
    await fetch(`${TAVUS_API_BASE}/conversations/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': TAVUS_API_KEY,
      },
    });
    console.log(`[Tavus] Conversation ended: ${sessionId}`);
  } catch (error) {
    console.warn(`[Tavus] Error ending conversation:`, error.message);
  }
}

/**
 * Test Tavus API connectivity
 * @returns {Promise<boolean>}
 */
async function testTavusConnection() {
  if (!TAVUS_API_KEY) {
    return false;
  }

  try {
    console.log(`[Tavus] Testing connectivity to ${TAVUS_API_BASE}`);
    
    const response = await fetch(`${TAVUS_API_BASE}/replicas`, {
      method: 'GET',
      headers: {
        'x-api-key': TAVUS_API_KEY,
      },
      timeout: 15000,
    });

    const ok = response.ok;
    const status = ok ? 'SUCCESS' : `FAILED (${response.status})`;
    console.log(`[Tavus] Connection test: ${status}`);
    return ok;
  } catch (error) {
    console.error(`[Tavus] Connection test failed:`, error.message);
    return false;
  }
}

module.exports = {
  startTavusSession,
  sendAudioToTavus,
  endTavusSession,
  testTavusConnection,
};
