# Tavus Avatar Backend


A production-ready backend system demonstrating real-time AI avatar interaction using Tavus native TTS. This implementation sends text to Tavus API which generates speech and animates the avatar with perfect lip-sync.

## 🎯 Key Features

- ✅ Tavus native TTS for perfect lip-sync
- ✅ Server-Sent Events (SSE) for efficient communication
- ✅ Simple iframe-based avatar display
- ✅ Text-to-avatar pipeline with no audio handling
- ✅ Modular, production-style architecture
- ✅ Comprehensive logging and metrics
- ✅ **Tavus avatar integration (complete)**: Creates conversation with custom_greeting, avatar speaks automatically

## 🏗️ Architecture

```
Backend/
├── server.js                  # Express server, routes, health check
├── routes/
│   └── speak.js              # POST /speak SSE handler
├── services/
│   ├── livekitService.js     # Tavus session orchestration
│   ├── tavusService.js       # Tavus API client
│   └── ttsStream.js          # Legacy file (not used)
├── public/
│   └── index.html            # Frontend client with avatar display
├── package.json
└── .env
```

### Architecture Highlights

**Streaming Flow (Current Implementation):**
1. Client sends POST /speak with text and `enableTavus` flag
2. Server establishes SSE connection
3. If `enableTavus=true`:
   - Creates Tavus conversation with text as `custom_greeting`
   - Tavus generates speech and animates avatar automatically
   - Returns conversation URL (Daily.co room)
4. Frontend receives conversation URL via SSE
5. Avatar displays in iframe and speaks the text with perfect lip-sync

**Key Design Decisions:**
- **Tavus Native TTS:** Eliminates need for local TTS generation and audio streaming
- **Simple iframe embedding:** No WebRTC client needed, just display conversation URL
- **Immediate response:** Tavus session created in 4-5 seconds
- **Modular services:** Tavus integration is independent and clean
- **Perfect lip-sync:** Tavus handles speech generation and animation internally

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
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
TAVUS_REPLICA_ID=your_replica_id_here
```

### Access the Application

- Frontend: http://localhost:3000
- API Endpoint: POST http://localhost:3000/speak
- Health Check: GET http://localhost:3000/health
- Tavus Diagnostics: GET http://localhost:3000/test-tavus

## 📡 API Reference

### POST /speak

Creates Tavus conversation and sends avatar URL via Server-Sent Events.

**Request:**
```json
{
  "text": "Hello, this is text that the avatar will speak",
  "enableTavus": true
}
```

**Response:** SSE stream

```
data: {"type":"tavus","conversationUrl":"https://tavus.daily.co/abc123"}

data: {"type":"complete","message":"Avatar will speak the text"}
```

**Event Types:**
- `tavus`: Tavus conversation created with URL to display in iframe
- `complete`: Request finished, avatar ready
- `error`: Error occurred during conversation creation

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
   - Processes Tavus conversation events
   - Handles errors gracefully

2. **Avatar Display**
   - Simple iframe embedding of Tavus conversation
   - Avatar displays and speaks automatically
   - No complex audio handling needed

3. **Real-time Status**
   - Connection status
   - Avatar loading state
   - Status indicators (connecting, ready, speaking)

4. **Controls**
   - Text input for avatar speech
   - Toggle for Tavus avatar
   - Live event logging

5. **Clean UI**
   - Responsive design
   - Status bar with color coding
   - Timestamped logs with proper spacing

## 🔊 Speech Implementation

### Tavus Native TTS

Tavus handles all speech generation internally:

- **Input:** Plain text via `custom_greeting` field
- **Output:** Avatar speaks the text with lip-sync
- **Latency:** ~4-5 seconds to create conversation
- **Quality:** Professional TTS with natural voice
- **Sync:** Perfect lip-sync (handled by Tavus)

### How It Works

1. **Text Input:** User provides text to speak
2. **API Request:** Backend sends text to Tavus as `custom_greeting`
3. **Tavus Processing:** Tavus generates speech and prepares avatar
4. **Conversation URL:** Tavus returns Daily.co room URL
5. **Frontend Display:** Iframe loads conversation, avatar speaks automatically

## 🎭 Tavus Integration

### Current Status: ✅ Fully Implemented

**What Works:**
1. ✅ **Conversation Creation**:
   - POST to `https://tavusapi.com/v2/conversations`
   - Sends text as `custom_greeting` field
   - Creates Daily.co room with Tavus avatar
   - Returns `conversation_url` for iframe embedding

2. ✅ **Avatar Display & Speech**:
   - Avatar displays in iframe (Daily.co room)
   - Avatar automatically speaks the `custom_greeting` text
   - Perfect lip-sync (handled by Tavus native TTS)
   - No external audio handling needed

### Implementation Details

**custom_greeting Field:**
The key to making Tavus avatars speak is the `custom_greeting` field:

```javascript
const conversationData = {
  replica_id: process.env.TAVUS_REPLICA_ID,
  persona_id: process.env.TAVUS_PERSONA_ID,
  custom_greeting: "This text will be spoken by the avatar"
};
```

When a user joins the conversation, the avatar automatically:
1. Generates speech from the `custom_greeting` text
2. Animates the avatar with perfect lip-sync
3. Speaks the greeting without any external audio input

**iframe Embedding:**
Display the avatar by embedding the conversation URL:

```html
<iframe 
  src="{conversationUrl}" 
  allow="camera; microphone; autoplay; display-capture"
  style="width: 100%; height: 600px; border: none;">
</iframe>
```

### Architecture Flow

**Current Implementation:**
```
  User Input (text)
       ↓
  POST /speak
       ↓
  Backend creates Tavus conversation
  (custom_greeting = text)
       ↓
  Tavus API generates speech + animates avatar
       ↓
  conversation_url via SSE
       ↓
  Frontend displays iframe
       ↓
  Avatar speaks with lip-sync ✅
```

### Known Limitations

1. **Tavus API Credits**
   - Each conversation creation consumes API credits
   - Monitor usage to avoid unexpected costs
   - Test sparingly during development

2. **Tavus Network Requirements**
   - Requires connection to `tavusapi.com:443`
   - Daily.co domains must be accessible for iframe embedding
   - Use VPN/proxy if firewall blocks these domains

3. **Single Greeting Per Conversation**
   - `custom_greeting` is spoken once when user joins
   - For multi-turn conversations, need to create new conversations
   - Consider implementing conversation management for extended interactions

## 📊 Performance Metrics

Expected performance:

| Metric | Value |
|--------|-------|
| **Conversation Creation** | ~4-5 seconds |
| **Avatar Load Time** | ~2-3 seconds (iframe) |
| **Time to Speech** | Immediate (on join) |
| **Total Time to Speaking** | ~6-8 seconds |
| **Lip-Sync Accuracy** | Perfect (Tavus native) |

Example workflow:
- User submits text: 0s
- Backend creates conversation: 4s
- Frontend receives URL: 4s
- Iframe loads avatar: 6s
- Avatar begins speaking: 6-8s

## 🧪 Testing

### Test the API directly with cURL:

```bash
# Create Tavus conversation
curl -X POST http://localhost:3000/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, I am your AI avatar","enableTavus":true}'

# Test Tavus connectivity
curl http://localhost:3000/test-tavus
```

### Expected Console Output:

```
[Route] Tavus avatar request
[Route] Text: "Hello, I am your AI avatar"
[Route] Tavus enabled: true
[Route] SSE connection established
[LiveKit] Creating Tavus session...
[Tavus] Starting session with custom greeting
[Tavus] Conversation created: https://tavus.daily.co/abc123
[Route] Sent Tavus conversation URL
[Route] Request complete
```

### Browser Console (DevTools):

Should show logs like:
```
Connected to streaming endpoint
Received Tavus conversation URL
Displaying avatar in iframe
Avatar ready! Wait for it to speak...
Request complete
```

## 🛣️ Project Status

This project implements a complete AI avatar pipeline:

- ✅ Text input interface
- ✅ Tavus conversation creation with custom_greeting
- ✅ Avatar display via iframe embedding
- ✅ Automatic speech with perfect lip-sync
- ✅ Clean, maintainable codebase
- ✅ Production-ready error handling

**Future Enhancements:**
- [ ] Multi-turn conversations (conversation management)
- [ ] Multiple Tavus personas/replicas
- [ ] Expression/emotion control
- [ ] 2-way audio with microphone
- [ ] Conversation history and state
- [ ] Custom voice selection

## 🐛 Troubleshooting

### "Connection failed to Tavus"
- Check your network allows `tavusapi.com:443`
- Test with: `curl -v https://tavusapi.com`
- Use `/test-tavus` endpoint for diagnostics
- Try VPN/proxy if firewall blocks Tavus

### "No avatar appearing"
- Verify Tavus API key, Persona ID, and Replica ID in .env
- Check server logs for "[Tavus] Conversation created" message
- Ensure `enableTavus: true` in request
- Check browser console for iframe loading errors
- Verify Daily.co domains are not blocked

### "Avatar loads but doesn't speak"
- Check that `custom_greeting` field is sent to Tavus API
- Verify text is not empty
- Check Tavus replica has TTS enabled
- Wait 6-8 seconds for avatar to initialize
- Check browser console for errors

### "API key or persona ID missing"
- Ensure .env file exists in project root
- Verify all three variables are set: API_KEY, PERSONA_ID, REPLICA_ID
- Restart server after updating .env
- Check server logs for environment variable errors

## 📝 Code Structure

### Key Files

- **server.js** (~60 lines)
  - Express setup, middleware, route registration
  - Health check endpoint
  - Tavus diagnostics endpoint

- **routes/speak.js** (~80 lines)
  - POST /speak handler
  - SSE response setup
  - Tavus conversation URL delivery
  - Error handling

- **services/livekitService.js** (~60 lines)
  - Orchestrates Tavus session creation
  - Returns empty chunks array (no TTS generation)
  - Simplified for Tavus-only approach

- **services/tavusService.js** (~80 lines)
  - Tavus API client
  - Creates conversations with custom_greeting
  - Returns conversation URL and session details
  - Connection diagnostics

- **services/ttsStream.js** (~70 lines)
  - Legacy file (not used)
  - Can be deleted

- **public/index.html** (~315 lines)
  - Clean UI with integrated CSS/JS
  - SSE event processing
  - Simple iframe embedding for avatar
  - Real-time logging with proper spacing
  - Status indicators

## 📄 License

MIT

---

