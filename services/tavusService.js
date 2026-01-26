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
  if (!TAVUS_API_KEY || !TAVUS_PERSONA_ID) {
    console.warn('[Tavus] API key or persona ID missing. Tavus disabled.');
    return { disabled: true };
  }

  try {
    // Construct URL properly - don't append /stream-sessions if already in base
    const endpoint = TAVUS_API_BASE.includes('stream-sessions') 
      ? TAVUS_API_BASE 
      : `${TAVUS_API_BASE}/stream-sessions`;
    
    console.log(`[Tavus] Creating session at: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY,
      },
      body: JSON.stringify({
        persona_id: TAVUS_PERSONA_ID,
        video_resolution: '720p',
        // Tavus will use streaming audio, not pre-recorded
        audio_source: 'stream',
      }),
      timeout: 3000, // 3 second timeout - fail fast
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tavus] API error response: ${errorText}`);
      throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
    }

    const session = await response.json();
    console.log(`[Tavus] Session created: ${session.session_id || 'unknown'}`);
    console.log(`[Tavus] Stream URL: ${session.stream_url || session.url || 'unknown'}`);

    return {
      sessionId: session.session_id || session.id,
      streamUrl: session.stream_url || session.url,
      disabled: false,
    };
  } catch (error) {
    console.error('[Tavus] Failed to start session:', error.message);
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
async function sendAudioToTavus(sessionId, audioChunk, timestamp) {
  if (!TAVUS_API_KEY) {
    return; // Tavus disabled
  }

  try {
    // Convert PCM chunk to base64 for transmission
    const base64Audio = audioChunk.toString('base64');

    const response = await fetch(
      `${TAVUS_API_BASE}/stream-sessions/${sessionId}/audio`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TAVUS_API_KEY,
        },
        body: JSON.stringify({
          audio_data: base64Audio,
          timestamp_ms: timestamp,
        }),
      }
    );

    if (!response.ok && response.status !== 204) {
      console.warn(
        `[Tavus] Audio push failed: ${response.status}. Continuing anyway...`
      );
    }
  } catch (error) {
    console.warn(`[Tavus] Error sending audio chunk:`, error.message);
    // Continue streaming even if Tavus has issues
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
    await fetch(`${TAVUS_API_BASE}/stream-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': TAVUS_API_KEY,
      },
    });
    console.log(`[Tavus] Session ended: ${sessionId}`);
  } catch (error) {
    console.warn(`[Tavus] Error ending session:`, error.message);
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
    const endpoint = TAVUS_API_BASE.includes('stream-sessions') 
      ? TAVUS_API_BASE.replace('/stream-sessions', '')
      : TAVUS_API_BASE;
    
    console.log(`[Tavus] Testing connectivity to ${endpoint}`);
    
    const response = await fetch(`${endpoint}/personas`, {
      method: 'GET',
      headers: {
        'x-api-key': TAVUS_API_KEY,
      },
      timeout: 3000,
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
