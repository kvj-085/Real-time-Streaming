/**
 * Streaming TTS Service
 * 
 * WHY STREAMING IS NECESSARY:
 * - In real-time avatar systems, users expect immediate audio feedback
 * - Waiting for full audio generation creates noticeable latency (seconds)
 * - Streaming allows first audio chunk to play while rest is still generating
 * - This creates the illusion of instant response, critical for conversational AI
 * 
 * WHY CHUNKED AUDIO IS REQUIRED:
 * - Audio must be processed and played incrementally
 * - Smaller chunks = lower latency, smoother playback
 * - Enables progressive rendering: user hears beginning while end is generating
 * - Matches how real-time TTS APIs work (ElevenLabs, Azure, Google Cloud)
 */

/**
 * Mock streaming TTS generator
 * Simulates a real TTS API that generates audio progressively
 * 
 * @param {string} text - The text to convert to speech
 * @yields {Buffer} Audio chunk as PCM data
 */
async function* generateStreamingAudio(text) {
  // Simulate TTS processing: each word takes time to generate
  const words = text.split(' ');
  const chunkDelayMs = 50; // Send new chunk every 50ms (simulates generation time)
  
  console.log(`[TTS Service] Starting audio generation for: "${text}"`);
  console.log(`[TTS Service] Will generate ${words.length} chunks`);
  
  for (let i = 0; i < words.length; i++) {
    const startTime = Date.now();
    
    // Simulate audio data generation for this word
    // In production, this would be actual PCM/WAV/MP3 data from TTS API
    // Here we generate mock audio chunks (random bytes simulating audio)
    const chunkSize = Math.floor(Math.random() * 2000) + 1000; // 1-3KB per chunk
    const audioChunk = Buffer.from(
      Array.from({ length: chunkSize }, () => Math.floor(Math.random() * 256))
    );
    
    const elapsed = Date.now() - startTime;
    console.log(
      `[TTS Service] Chunk ${i + 1}/${words.length} generated | ` +
      `Size: ${chunkSize} bytes | ` +
      `Elapsed: ${elapsed}ms`
    );
    
    // Yield the audio chunk
    yield audioChunk;
    
    // Simulate processing delay (real TTS APIs have natural delays)
    await new Promise(resolve => setTimeout(resolve, chunkDelayMs));
  }
  
  console.log(`[TTS Service] Audio generation complete`);
}

/**
 * Create a streaming TTS session
 * In production, this would:
 * - Connect to real TTS API (ElevenLabs, Azure, etc.)
 * - Handle authentication
 * - Configure voice settings
 * 
 * @param {string} text - Text to convert to speech
 * @returns {AsyncGenerator} Stream of audio chunks
 */
function createTTSStream(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }
  
  // Validate text length (prevent abuse)
  if (text.length > 5000) {
    throw new Error('Text too long. Maximum 5000 characters.');
  }
  
  return generateStreamingAudio(text);
}

module.exports = {
  createTTSStream
};
