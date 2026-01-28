/**
 * Streaming TTS generator (mock)
 *
 * WHY STREAMING IS NECESSARY:
 * - Conversational systems need the first audio chunk immediately to feel responsive
 * - Waiting for a full file adds seconds of latency, breaking real-time UX
 * - Streaming lets playback start while generation continues
 *
 * WHY CHUNKED AUDIO IS REQUIRED:
 * - Low-latency playback expects small buffers (~20–50ms) that can be scheduled tightly
 * - Small chunks keep jitter low and avoid long buffering pauses
 * - Mirrors how production TTS APIs deliver progressive audio
 */

const SAMPLE_RATE = 48000; // 48kHz PCM keeps WebRTC happy
const CHANNELS = 1; // mono for speech
const CHUNK_DURATION_MS = 40; // 20–50ms target; 40ms is a good middle ground

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Synthesize speech using Windows SAPI via PowerShell and return raw PCM16LE.
 * Keeps everything local (no cloud) and outputs 48kHz mono audio.
 */
async function synthesizeWithSapi(text) {
  // Escape text for PowerShell by encoding as base64
  const textB64 = Buffer.from(text).toString('base64');
  const psScript = `
$text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${textB64}'));
Add-Type -AssemblyName System.Speech;
$Synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo 48000, ([System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen), ([System.Speech.AudioFormat.AudioChannel]::Mono);
$ms = New-Object System.IO.MemoryStream;
$Synth.SetOutputToAudioStream($ms, $format);
$Synth.Speak($text);
$Synth.Dispose();
$ms.Position = 0;
[Convert]::ToBase64String($ms.ToArray());`;

  const { stdout } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-Command', psScript],
    { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
  );

  const trimmed = stdout.toString().trim();
  if (!trimmed) {
    throw new Error('Empty audio from SAPI');
  }
  return Buffer.from(trimmed, 'base64');
}

/**
 * Streaming audio generator that yields PCM16 chunks at CHUNK_DURATION_MS.
 * Uses offline Windows SAPI for real speech.
 *
 * @param {string} text - Text to convert to speech
 * @yields {Buffer} PCM16 audio chunk sized for CHUNK_DURATION_MS
 */
async function* generateTTSChunks(text) {
  // Generate real speech via Windows SAPI
  console.log('[TTS] Synthesizing with Windows SAPI...');
  const pcmBuffer = await synthesizeWithSapi(text);

  const samplesPerChunk = Math.floor((SAMPLE_RATE * CHUNK_DURATION_MS) / 1000);
  const totalSamples = Math.floor(pcmBuffer.byteLength / 2);
  const totalChunks = Math.max(1, Math.ceil(totalSamples / samplesPerChunk));

  console.log(`[TTS] Starting stream | chunks=${totalChunks} | chunkDuration=${CHUNK_DURATION_MS}ms`);

  for (let i = 0; i < totalChunks; i++) {
    const chunkStart = Date.now();
    const byteStart = i * samplesPerChunk * 2;
    const byteEnd = Math.min(pcmBuffer.byteLength, byteStart + samplesPerChunk * 2);
    const buffer = pcmBuffer.subarray(byteStart, byteEnd);
    const elapsed = Date.now() - chunkStart;
    console.log(`[TTS] Chunk ${i + 1}/${totalChunks} ready | ${buffer.byteLength} bytes | genTime=${elapsed}ms`);

    yield buffer;
    // No sleep - stream chunks as fast as possible
  }

  console.log('[TTS] Stream complete');
}

function createTTSStream(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS');
  }

  if (text.length > 50000) {
    throw new Error('Text too long. Max 50000 characters.');
  }

  return generateTTSChunks(text);
}

module.exports = {
  createTTSStream,
  SAMPLE_RATE,
  CHANNELS,
  CHUNK_DURATION_MS
};
