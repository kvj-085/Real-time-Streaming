/**
 * Speak Route Handler (STEP 3)
 *
 * Streams TTS chunks via Server-Sent Events (SSE).
 * Simultaneously sends audio to Tavus for avatar rendering.
 * Returns video stream URL for avatar display.
 */

const { streamTTSChunks } = require('../services/livekitService');

/**
 * POST /speak
 * Accepts JSON: { "text": "some text" }
 * Streams audio chunks directly into the LiveKit room audio track.
 * Frontend will subscribe to the AI-Speaker participant to hear the audio.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function speakHandler(req, res) {
  const { text, enableTavus } = req.body;
  
  // Validate input
  if (!text) {
    return res.status(400).json({ 
      error: 'Missing required field: text' 
    });
  }
  
  console.log(`\n[Route] TTS + Tavus request`);
  console.log(`[Route] Text: "${text}"`);
  console.log(`[Route] Tavus enabled: ${enableTavus !== false}`);
  
  try {
    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    console.log(`[Route] SSE connection established`);
    
    // Generate TTS chunks and stream to Tavus simultaneously
    const result = await streamTTSChunks(text, enableTavus !== false);
    
    const requestStartTime = Date.now();
    
    // Stream each chunk to client
    for (let i = 0; i < result.chunks.length; i++) {
      const base64Audio = result.chunks[i];
      const elapsedMs = Date.now() - requestStartTime;
      
      // Send SSE message with audio chunk
      res.write(`data: ${JSON.stringify({
        type: 'audio',
        chunk: base64Audio,
        index: i + 1,
        timestamp: Date.now(),
        elapsed: elapsedMs
      })}\n\n`);
      
      console.log(
        `[Route] Sent chunk ${i + 1}/${result.chunks.length} | ` +
        `Base64 size: ${base64Audio.length} chars`
      );
    }
    
    // Send Tavus conversation URL to client
    if (result.tavusSession) {
      res.write(`data: ${JSON.stringify({
        type: 'tavus',
        conversationUrl: result.tavusSession.conversation_url
      })}\n\n`);
      
      console.log(`[Route] Sent Tavus conversation URL to client`);
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      totalChunks: result.chunks.length,
      totalTime: Date.now() - requestStartTime,
      tavusEnabled: !!result.tavusSession,
    })}\n\n`);
    
    console.log(`[Route] Stream complete. Total chunks: ${result.chunks.length}`);
    console.log(`[Route] Total time: ${Date.now() - requestStartTime}ms\n`);
    
    // End the SSE stream
    res.end();
    
  } catch (error) {
    console.error(`[Route] Error during streaming:`, error);
    
    // Send error event to client
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message
    })}\n\n`);
    
    res.end();
  }
}

module.exports = {
  speakHandler
};
