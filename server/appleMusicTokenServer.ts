import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const app = express();
const port = Number(process.env.APPLE_MUSIC_TOKEN_PORT || 18787);
const host = process.env.APPLE_MUSIC_TOKEN_HOST || '0.0.0.0';

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Music-User-Token');
  next();
});

const base64url = (value: string | Buffer) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const readPrivateKey = () => {
  if (process.env.APPLE_MUSIC_PRIVATE_KEY) {
    return process.env.APPLE_MUSIC_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  if (process.env.APPLE_MUSIC_PRIVATE_KEY_PATH) {
    return fs.readFileSync(process.env.APPLE_MUSIC_PRIVATE_KEY_PATH, 'utf8');
  }

  throw new Error('Missing APPLE_MUSIC_PRIVATE_KEY or APPLE_MUSIC_PRIVATE_KEY_PATH.');
};

const createDeveloperToken = () => {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  if (!teamId || !keyId) {
    throw new Error('Missing APPLE_MUSIC_TEAM_ID or APPLE_MUSIC_KEY_ID.');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 30;
  const header = {
    alg: 'ES256',
    kid: keyId,
  };
  const payload = {
    iss: teamId,
    iat: issuedAt,
    exp: expiresAt,
  };

  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('sha256', Buffer.from(unsignedToken), {
    key: readPrivateKey(),
    dsaEncoding: 'ieee-p1363',
  });

  return `${unsignedToken}.${base64url(signature)}`;
};

app.get('/apple-music/developer-token', (_req, res) => {
  try {
    res.json({
      developerToken: createDeveloperToken(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create Apple Music developer token.',
    });
  }
});

app.listen(port, host, () => {
  console.log(`Apple Music token server listening on http://${host}:${port}`);
});
