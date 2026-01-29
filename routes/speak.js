/**
 * Speak Route Handler (Tavus TTS)
 *
 * Creates Tavus conversation with text.
 * Avatar generates speech and lip-syncs automatically.
 * Returns conversation URL for frontend to display.
 */

const { streamTTSChunks } = require('../services/livekitService');

async function speakHandler(req, res) {
  const { text, enableTavus } = req.body;
  
  // Validate input
  if (!text) {
    return res.status(400).json({ 
      error: 'Missing required field: text' 
    });
  }
  
  console.log(`\n[Route] Tavus TTS request`);
  console.log(`[Route] Text: "${text}"`);
  console.log(`[Route] Tavus enabled: ${enableTavus !== false}`);
  
  try {
    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    console.log(`[Route] SSE connection established`);
    
    // Create Tavus conversation with text
    const result = await streamTTSChunks(text, enableTavus !== false);
    
    // Send Tavus conversation URL to client
    if (result.tavusSession) {
      console.log(`[Route] Tavus session created: ${result.tavusSession.viewerUrl}`);
      const tavusMessage = {
        type: 'tavus',
        conversationUrl: result.tavusSession.viewerUrl
      };
      res.write(`data: ${JSON.stringify(tavusMessage)}\n\n`);
      console.log(`[Route] ✓ Tavus URL sent to client`);
    } else {
      console.log(`[Route] ⚠️ No Tavus session available`);
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      tavusEnabled: !!result.tavusSession,
      message: result.tavusSession ? 'Avatar will speak the text' : 'Tavus unavailable'
    })}\n\n`);
    
    console.log(`[Route] Complete. Tavus: ${result.tavusSession ? 'active' : 'disabled'}\n`);
    
    // End the SSE stream
    res.end();
    
  } catch (error) {
    console.error(`[Route] Error:`, error);
    
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
