const { AccessToken } = require('livekit-server-sdk');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

function buildToken(roomName, identity, { canPublish, canSubscribe }) {
  if (!roomName) {
    throw new Error('room is required');
  }
  if (!identity) {
    throw new Error('identity is required');
  }

  const key = requireEnv('LIVEKIT_API_KEY');
  const secret = requireEnv('LIVEKIT_API_SECRET');

  const at = new AccessToken(key, secret, {
    identity,
    ttl: 60 * 60, // 1 hour
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe,
  });

  return at.toJwt();
}

function createSpeakerToken(roomName) {
  // AI-Speaker is the server-side publisher participant
  return buildToken(roomName, 'AI-Speaker', {
    canPublish: true,
    canSubscribe: false,
  });
}

function createUserToken(roomName) {
  // Frontend participant that only listens to the AI-Speaker audio track
  return buildToken(roomName, 'user', {
    canPublish: false,
    canSubscribe: true,
  });
}

module.exports = {
  createSpeakerToken,
  createUserToken,
};
