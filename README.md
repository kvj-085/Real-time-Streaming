# Real-time Streaming TTS + Tavus Avatar Backend


A production-ready backend system demonstrating real-time audio streaming synchronized with AI avatar video rendering. This implementation streams TTS audio chunks to both the Tavus Persona API (for lip-sync rendering) and the frontend client (for Web Audio playback).

## 🎯 Key Features

- ✅ Real-time streaming TTS using Windows SAPI (offline, no cloud latency)
- ✅ Server-Sent Events (SSE) for efficient one-way streaming
- ✅ PCM16 audio at 48kHz, mono, 40ms chunks
- ✅ Base64-encoded audio chunk transport
- ✅ Web Audio API client for seamless playback
- ✅ Modular, production-style architecture
- ✅ Comprehensive logging and metrics
- ⚠️ **Tavus avatar integration (partial)**: Creates conversation and displays video stream, but **audio lip-sync requires WebRTC client** (not REST API)

## 🏗️ Architecture

```
Backend/
├── server.js                  # Express server, routes, health check
├── routes/
│   └── speak.js              # POST /speak SSE handler
├── services/
│   ├── ttsStream.js          # Windows SAPI TTS generator (real speech)
│   ├── livekitService.js     # TTS orchestration + Tavus coordination
│   ├── tavusService.js       # Tavus Persona API client
│   ├── tokenService.js       # LiveKit token generation
│   └── tavusService.js       # Tavus API integration
├── public/
│   └── index.html            # Frontend client + video player
├── package.json
└── .env
```

### Architecture Highlights

**Streaming Flow (Current Implementation):**
1. Client sends POST /speak with text and `enableTavus` flag
2. Server establishes SSE connection
3. Windows SAPI synthesizes speech to PCM16LE at 48kHz (offline, instant)
4. TTS chunks are streamed:
   - **Path A:** Base64 chunks → SSE → Frontend → Web Audio API playback ✅
   - **Path B (Not Working):** ~~Raw PCM chunks → Tavus API~~ ❌ (No REST endpoint available)
5. If `enableTavus=true`:
   - Creates Tavus conversation (background, non-blocking)
   - Returns Daily.co viewer URL and HLS stream URL
   - Avatar video displays (idle state, no lip-sync)
6. Audio plays through Web Audio API only (not synced to avatar)

**Key Design Decisions:**
- **Offline TTS:** Windows SAPI eliminates cloud API latency (~100-300ms saved)
- **Non-blocking Tavus:** Promise-based background connection prevents TTS delay
- **Immediate streaming:** First audio chunk arrives in <100ms
- **Modular services:** TTS, Tavus, tokens are independent
- **Tavus Limitation Discovered:** Tavus Conversations API requires WebRTC (Daily.co SDK), not REST audio push

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Windows 10/11 (for SAPI TTS)
- .env file with Tavus credentials

### Installation

```bash
# Install dependencies
npm install

# Create .env file (see .env.example)
# Add your Tavus API key and Persona ID

# Run the server
npm start

# Or use auto-reload during development
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```env
TAVUS_API_KEY=your_api_key_here
TAVUS_PERSONA_ID=your_persona_id_here
```

### Access the Application

- Frontend: http://localhost:3000
- API Endpoint: POST http://localhost:3000/speak
- Health Check: GET http://localhost:3000/health
- Tavus Diagnostics: GET http://localhost:3000/test-tavus

## 📡 API Reference

### POST /speak

Streams TTS audio chunks via Server-Sent Events and optionally renders avatar via Tavus.

**Request:**
```json
{
  "text": "Hello, this is real-time streaming text-to-speech with avatar",
  "enableTavus": true
}
```

**Response:** SSE stream

```
data: {"type":"audio","chunk":"base64_audio_data","index":1,"timestamp":1234567890,"elapsed":77}

data: {"type":"audio","chunk":"base64_audio_data","index":2,"timestamp":1234567942,"elapsed":119}

data: {"type":"tavus","sessionId":"abc123","streamUrl":"https://...m3u8"}

data: {"type":"complete","totalChunks":38,"totalTime":1848,"tavusEnabled":true}
```

**Event Types:**
- `audio`: Audio chunk with base64-encoded PCM16LE data (48kHz, mono)
- `tavus`: Tavus session started with video stream URL (HLS)
- `complete`: Stream finished with metrics
- `error`: Error occurred during generation

### GET /test-tavus

Diagnostic endpoint to test Tavus API connectivity.

**Response:**
```json
{
  "tavus": "connected" | "failed",
  "apiKey": "set" | "missing",
  "personaId": "set" | "missing"
}
```

## 🎨 Frontend Features

The included HTML client demonstrates:

1. **SSE Connection Management**
   - Connects to `/speak` endpoint
   - Processes audio and Tavus events
   - Handles errors gracefully

2. **Avatar Video Display**
   - HLS.js for video streaming
   - Auto-plays Tavus avatar when session ready
   - Falls back for native HLS support

3. **Web Audio API Integration**
   - Decodes base64 PCM16LE chunks
   - Schedules seamless playback at 48kHz
   - Prevents gaps between chunks
   - Maintains perfect sync with avatar lip-sync

4. **Real-time Metrics**
   - Chunks received count
   - Total streaming duration
   - Status indicators (connecting, streaming, complete)

5. **Controls**
   - Text input for speech
   - Toggle for Tavus avatar
   - Live event logging

## � Audio Implementation

### Windows SAPI TTS (services/ttsStream.js)

Uses offline Windows `System.Speech.Synthesis.SpeechSynthesizer` for real speech:

- **Sample Rate:** 48kHz (matches WebRTC standards)
- **Channels:** Mono
- **Bit Depth:** 16-bit PCM (signed, little-endian)
- **Chunk Duration:** 40ms per chunk
- **Latency:** ~200-500ms synthesis time (one-time)
- **Output:** Direct streaming, no intermediate files

### Audio Format Details

```
PCM16LE Audio Specification:
- Format: Signed 16-bit PCM, little-endian
- Sample Rate: 48000 Hz
- Channels: 1 (mono)
- Chunk Size: 3840 bytes (1920 samples × 2 bytes/sample)
- Duration per Chunk: 40ms
- Bitrate: 768 kbps
```

### Frontend Decoding (public/index.html)

1. **Base64 Decoding:** `atob()` converts SSE-transmitted base64 to binary
2. **PCM16 Parsing:** DataView reads 16-bit signed integers at correct endianness
3. **Normalization:** Scale to [-1, 1] float range for Web Audio API
4. **Scheduling:** Use `audioContext.currentTime` for seamless playback
5. **Sync:** Tavus receives same PCM chunks for perfect lip-sync

## 🎭 Tavus Integration

### Current Status: ⚠️ Partial Implementation

**What Works:**
1. ✅ **Conversation Creation**:
   - POST to `https://tavusapi.com/v2/conversations`
   - Creates Daily.co room with Tavus avatar
   - Returns `conversation_url` (Daily.co WebRTC room) and HLS stream URL

2. ✅ **Video Display**:
   - Avatar video streams via HLS (.m3u8)
   - Frontend displays avatar in idle/waiting state
   - Uses HLS.js for playback

**What Doesn't Work:**
- ❌ **Audio Lip-Sync**: Tavus does **not** provide a REST API endpoint for audio ingest
- ❌ **Audio Push**: `/conversations/{id}/audio` endpoint returns 404
- ❌ **Server-side Integration**: Cannot send TTS audio from backend to Tavus

### Why Audio Doesn't Work

Tavus Conversations are built on **Daily.co (WebRTC)**, not REST APIs. The `conversation_url` is a Daily.co room that expects:
- WebRTC clients to join as participants
- Audio sent via WebRTC media streams (microphone/virtual audio)
- Not HTTP POST requests with audio chunks

### How to Actually Get Audio Working

You need to join the Daily.co room **as a WebRTC participant** using Daily's client SDK:

**Option 1: Browser-based (Recommended)**
```javascript
// Install: npm install @daily-co/daily-js
import DailyIframe from '@daily-co/daily-js';

// Join Tavus conversation as participant
const daily = DailyIframe.createCallObject();
await daily.join({ url: tavusConversationUrl });

// Send TTS audio as virtual microphone
const audioTrack = createAudioTrackFromPCM(ttsChunks);
await daily.setInputDevicesAsync({
  audioSource: audioTrack
});
```

**Option 2: Server-side WebRTC**
- Use Daily's REST API to create a meeting token
- Use a headless WebRTC client (e.g., daily-python with virtual audio device)
- Join room programmatically and stream TTS audio
- More complex, but enables fully server-side operation

### Architecture: Current vs. Target

**Current (Audio Only):**
```
TTS Generated (PCM16LE)
       ↓
    Base64
       ↓
      SSE
       ↓
   Frontend
       ↓
  Web Audio API
       ↓
    Speaker ✅
```

**Target (With Avatar Lip-Sync - Requires WebRTC):**
```
TTS Generated (PCM16LE)
       ↓
   ┌───┴────────┐
   ↓            ↓
Base64      WebRTC Track
   ↓            ↓
  SSE      Daily.co SDK
   ↓            ↓
Frontend   Tavus Avatar
   ↓            ↓
Web Audio   Lip-Sync ⚠️
   ↓            ↓
   └─────┬──────┘
      Speaker

⚠️ = Not yet implemented
```

### Known Issues & Limitations

1. **Tavus Audio Not Syncing (Major)**
   - **Issue:** Tavus avatar displays but doesn't lip-sync to TTS audio
   - **Root Cause:** Tavus Conversations API expects WebRTC audio, not REST API posts
   - **Current State:** Avatar shows idle/waiting, audio plays separately through Web Audio
   - **Solution:** Implement Daily.co WebRTC client to join conversation and send audio as media track
   - **Workaround:** Use audio-only mode (`enableTavus: false`) for now

2. **No Server-Side Audio Ingest**
   - **Issue:** Cannot send TTS audio to Tavus from Node.js backend
   - **Root Cause:** `/conversations/{id}/audio` endpoint doesn't exist (404)
   - **Solution:** Must use WebRTC client (browser or headless) to join Daily.co room

3. **Tavus Network Requirements**
   - **Issue:** If firewall blocks `tavusapi.com:443`, conversation creation fails
   - **Solution:** Use VPN/proxy or whitelist `tavusapi.com` and `tavus.daily.co`
   - **Note:** TTS audio still works even if Tavus fails

## 📊 Performance Metrics

Expected performance:

| Metric | Value |
|--------|-------|
| **Time to First Audio** | ~1ms (after SAPI synthesis) |
| **SAPI Synthesis Time** | ~200-500ms (one-time) |
| **Chunk Interval** | 40ms |
| **Chunk Size** | ~3840 bytes (raw) / ~5120 chars (base64) |
| **Total Stream Time** | ~1.5-2s for typical speech |
| **Tavus Video Latency** | ~2-5s (network dependent) |

Example for "This is STEP 3..." (38 chunks):
- SAPI synthesis: ~300ms
- Chunk streaming: ~1500ms (38 × 40ms)
- Total: ~1800ms to end of audio
- Video appears: ~2-3s later (Tavus HLS buffering)

## 🧪 Testing

### Test the API directly with cURL:

```bash
# Stream audio only (no Tavus)
curl -X POST http://localhost:3000/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","enableTavus":false}'

# Stream with Tavus avatar
curl -X POST http://localhost:3000/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"I am speaking with an avatar","enableTavus":true}'

# Test Tavus connectivity
curl http://localhost:3000/test-tavus
```

### Expected Console Output (Audio Only):

```
[Route] TTS + Tavus request
[Route] Text: "Hello world"
[Route] Tavus enabled: false
[Route] SSE connection established
[TTS] Synthesizing with Windows SAPI...
[TTS] Starting stream | chunks=2 | chunkDuration=40ms
[TTS] Chunk 1/2 ready | 3840 bytes | genTime=1ms
[TTS Stream] Chunk 1 | 3840 bytes | elapsed=1ms | tavus=disabled
[TTS Stream] Chunk 2 | 3840 bytes | elapsed=52ms | tavus=disabled
[TTS] Stream complete
[TTS Stream] Completed 2 chunks in 100ms | Tavus: active
[Route] Sent chunk 1/2 | Base64 size: 5120 chars
[Route] Sent chunk 2/2 | Base64 size: 5120 chars
[Route] Stream complete. Total chunks: 2
[Route] Total time: 5ms
```

### Browser Console (DevTools):

Should show real-time logs like:
```
[UI] Connected to streaming endpoint
[UI] Audio chunk 1 (streaming...)
[UI] Audio chunk 2 (streaming...)
[UI] Stream finished (2 audio chunks, Tavus: no)
```

## 🛣️ Progression Steps

This project implements the full AI avatar pipeline:

- **STEP 1:** ✅ Streaming TTS without avatar (baseline)
- **STEP 2:** ✅ LiveKit token generation for WebRTC
- **STEP 3:** ⚠️ Tavus Persona API avatar rendering (partial)
  - ✅ Real speech synthesis (Windows SAPI)
  - ✅ Non-blocking Tavus conversation creation
  - ✅ HLS video streaming
  - ✅ Avatar video display
  - ❌ Audio lip-sync (requires WebRTC implementation)
  - ❌ Server-side audio push (not supported by Tavus)

**Next Steps (To Complete Step 3):**
- [ ] Integrate Daily.co client SDK in frontend
- [ ] Send TTS audio via WebRTC media track
- [ ] Join Tavus conversation as participant
- [ ] Achieve audio/video sync through WebRTC

**Future Enhancements:**
- Real TTS APIs (ElevenLabs, Azure, Google)
- Multiple Tavus personas
- Expression/emotion control
- 2-way audio with microphone
- Conversation state management

## 🐛 Troubleshooting

### "Audio not playing"
- Ensure browser allows AudioContext (requires user interaction first)
- Check browser console for decode errors
- Verify chunks are arriving in Network → EventStream tab
- Try audio-only mode (disable Tavus)

### "White noise instead of speech"
- Ensure Windows SAPI is working: test with `services/ttsStream.js` directly
- Check server logs for SAPI errors
- Try different text (some chars may fail parsing)

### "Connection failed to Tavus"
- This is expected if your network blocks `api.tavus.io:443`
- Check with: `curl -v https://api.tavus.io`
- Use `/test-tavus` endpoint for diagnostics
- Workaround: Use VPN/proxy that allows outbound HTTPS

### "Chunks arriving slowly"
- Windows SAPI synthesis takes 200-500ms (one-time)
- Once chunks start, they arrive rapidly (~40ms each)
- This is normal for offline TTS

### "No avatar video appearing"
- Check Tavus API key, Persona ID, and Replica ID in .env
- Verify Tavus connectivity with `/test-tavus`
- Check browser console for HLS.js errors
- Ensure `enableTavus: true` in request
- Check server logs for "[Tavus] Conversation created" message

### "Avatar shows but doesn't lip-sync"
- **This is expected in current implementation**
- Tavus requires WebRTC audio, not REST API
- Avatar will display in idle/waiting state
- Audio plays separately through Web Audio API
- To fix: Implement Daily.co WebRTC client (see Tavus Integration section)

## 📝 Code Structure

### Key Files

- **server.js** (~100 lines)
  - Express setup, middleware, route registration
  - Graceful shutdown with Tavus cleanup
  - Health check and diagnostics endpoints

- **routes/speak.js** (~80 lines)
  - POST /speak handler
  - SSE response setup
  - Chunk streaming loop
  - Error handling

- **services/ttsStream.js** (~70 lines)
  - Windows SAPI PowerShell integration
  - Base64 encoding of PCM16
  - Streaming generator with chunking

- **services/livekitService.js** (~100 lines)
  - Orchestrates TTS + Tavus
  - Non-blocking Tavus session management
  - Chunk buffering and delivery

- **services/tavusService.js** (~80 lines)
  - Tavus API client
  - Session creation and audio forwarding
  - Connection diagnostics

- **services/tokenService.js** (~30 lines)
  - LiveKit token generation
  - Currently unused (kept for future WebRTC)

- **public/index.html** (~380 lines)
  - Full-featured UI with Tailwind-like styling
  - SSE event processing
  - HLS.js video player integration
  - Web Audio API scheduling
  - Real-time logging panel

## 📄 License

MIT

---

