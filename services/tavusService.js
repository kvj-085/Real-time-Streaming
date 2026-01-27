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
 * Creates a new persona instance that will render avatar video
 * synchronized with incoming audio stream
 *
 * @param {string} sessionName - Unique name for this session
 * @returns {Promise<Object>} Session info with video stream URL
 */
async function startTavusSession(sessionName) {
  if (!TAVUS_API_KEY || !TAVUS_PERSONA_ID || !TAVUS_REPLICA_ID) {
    console.warn('[Tavus] API key, persona ID, or replica ID missing. Tavus disabled.');
    return { disabled: true };
  }

  try {
    const endpoint = `${TAVUS_API_BASE}/conversations`;
    
    console.log(`[Tavus] Creating conversation at: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY,
      },
      body: JSON.stringify({
        replica_id: TAVUS_REPLICA_ID,
        persona_id: TAVUS_PERSONA_ID,
      }),
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
    // Prefer any API-provided ingest endpoints before falling back
    const audioEndpoint =
      session.audio_url ||
      session.audio_endpoint ||
      session.ingest_url ||
      `${TAVUS_API_BASE}/conversations/${conversationId}/audio`;
    
    console.log(`[Tavus] Conversation created: ${conversationId}`);
    console.log(`[Tavus] Stream URL: ${streamUrl}`);
    console.log(`[Tavus] Viewer URL: ${session.conversation_url}`);
    console.log(`[Tavus] Session keys: ${Object.keys(session).join(', ')}`);
    
    // NOTE: Tavus does not provide a server-side audio ingest endpoint.
    // The conversation_url is a Daily.co room for WebRTC clients to join.
    // To send audio, you must join the Daily.co room as a participant using Daily's client SDK.
    // For now, we'll return the stream URL so you can see the avatar (idle state).
    console.warn('[Tavus] ⚠️  No server-side audio ingest available. Audio push disabled.');
    console.warn('[Tavus] To enable audio: join the Daily.co room as a WebRTC participant.');

    return {
      sessionId: conversationId,
      streamUrl: streamUrl,
      viewerUrl: session.conversation_url, // Daily.co room URL for WebRTC clients
      audioEndpoint: null, // No REST API for audio ingest
      disabled: false,
      audioDisabled: true, // Mark that audio push won't work
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
 * Send audio chunk to Tavus for avatar lip-sync
 * The avatar will analyze this audio frame and adjust mouth/expression accordingly
 *
 * @param {string} sessionId - Tavus session ID
 * @param {Buffer} audioChunk - Raw audio chunk (PCM16)
 * @param {number} timestamp - Timing info in ms
 * @returns {Promise<void>}
 */
async function sendAudioToTavus(sessionId, audioChunk, timestamp, audioEndpoint) {
  if (!TAVUS_API_KEY) {
    return; // Tavus disabled
  }

  // Basic guard to avoid endless 404 spam
  if (!sessionId) return;

  try {
    const base64Audio = audioChunk.toString('base64');
    const endpoint =
      audioEndpoint || `${TAVUS_API_BASE}/conversations/${sessionId}/audio`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY,
      },
      body: JSON.stringify({
        audio_data: base64Audio,
        timestamp_ms: timestamp,
      }),
    });

    if (!response.ok && response.status !== 204) {
      const bodyText = await response.text();
      const detail = bodyText ? ` | body: ${bodyText.slice(0, 200)}` : '';
      console.warn(
        `[Tavus] Audio push failed: ${response.status} at ${endpoint}${detail}`
      );
      // If 404, this endpoint may be wrong for this convo; stop further sends for this session
      if (response.status === 404) {
        throw new Error('audio-endpoint-404');
      }
      throw new Error(`audio-push-${response.status}`);
    }
  } catch (error) {
    console.warn(`[Tavus] Error sending audio chunk:`, error.message);
    // Re-throw so callers can disable Tavus when the endpoint is bad
    throw error;
  }
}

/**
 * End Tavus session
 * Stops avatar rendering and closes the stream
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
    console.log(`[Tavus] Connection test: ${ok ? 'SUCCESS' : `FAILED (${response.status})`}`);
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
