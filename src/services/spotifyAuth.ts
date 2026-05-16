import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const TOKEN_STORAGE_KEY = 'squarepod.spotifyTokens.v1';
const VERIFIER_STORAGE_KEY = 'squarepod.spotifyPkceVerifier.v1';
const STATE_STORAGE_KEY = 'squarepod.spotifyPkceState.v1';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-private',
];

export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

const randomString = (length: number) => {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map(value => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[value % 66])
    .join('');
};

const base64Url = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const codeChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(digest);
};

const readTokens = (): SpotifyTokens | undefined => {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const tokens = JSON.parse(raw) as SpotifyTokens;
    return tokens.accessToken ? tokens : undefined;
  } catch {
    return undefined;
  }
};

const writeTokens = (tokens: SpotifyTokens) => {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
};

const toTokens = (response: SpotifyTokenResponse, previous?: SpotifyTokens): SpotifyTokens => ({
  accessToken: response.access_token,
  refreshToken: response.refresh_token || previous?.refreshToken,
  expiresAt: Date.now() + Math.max(1, response.expires_in - 60) * 1000,
  scope: response.scope,
  tokenType: response.token_type,
});

const postToken = async (params: Record<string, string>) => {
  const body = new URLSearchParams(params);
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify token request failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<SpotifyTokenResponse>;
};

export const clearSpotifyTokens = () => {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export const hasSpotifyTokens = () => Boolean(readTokens()?.accessToken);

export const getSpotifyAccessToken = async (clientId: string) => {
  const tokens = readTokens();
  if (!tokens) return undefined;
  if (tokens.expiresAt > Date.now() + 10_000) return tokens.accessToken;
  if (!tokens.refreshToken) return undefined;

  const response = await postToken({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  const nextTokens = toTokens(response, tokens);
  writeTokens(nextTokens);
  return nextTokens.accessToken;
};

export const completeSpotifyAuthFromUrl = async (url: string, clientId: string, redirectUri: string) => {
  const callbackUrl = new URL(url);
  const error = callbackUrl.searchParams.get('error');
  if (error) throw new Error(`Spotify authorization failed: ${error}`);

  const code = callbackUrl.searchParams.get('code');
  const state = callbackUrl.searchParams.get('state');
  const expectedState = window.localStorage.getItem(STATE_STORAGE_KEY);
  const verifier = window.localStorage.getItem(VERIFIER_STORAGE_KEY);
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    throw new Error('Spotify authorization callback is invalid.');
  }

  const response = await postToken({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  window.localStorage.removeItem(VERIFIER_STORAGE_KEY);
  window.localStorage.removeItem(STATE_STORAGE_KEY);

  const tokens = toTokens(response);
  writeTokens(tokens);
  return tokens;
};

export const startSpotifyAuth = async (clientId: string, redirectUri: string) => {
  if (!clientId) throw new Error('Missing Spotify client ID.');

  const verifier = randomString(96);
  const state = randomString(32);
  const challenge = await codeChallenge(verifier);
  window.localStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  window.localStorage.setItem(STATE_STORAGE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  await Browser.open({ url: `${SPOTIFY_AUTH_URL}?${params.toString()}` });
};

export const waitForSpotifyAuth = (clientId: string, redirectUri: string) => new Promise<SpotifyTokens>((resolve, reject) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removeListener: (() => void) | undefined;

  const finish = (callback: () => void) => {
    if (timeout) clearTimeout(timeout);
    removeListener?.();
    callback();
  };

  App.addListener('appUrlOpen', async event => {
    if (!event.url.startsWith(redirectUri)) return;
    try {
      await Browser.close();
      const tokens = await completeSpotifyAuthFromUrl(event.url, clientId, redirectUri);
      finish(() => resolve(tokens));
    } catch (error) {
      finish(() => reject(error));
    }
  }).then(handle => {
    removeListener = () => {
      handle.remove();
    };
  }).catch(error => {
    finish(() => reject(error));
  });

  timeout = setTimeout(() => {
    finish(() => reject(new Error('Spotify authorization timed out.')));
  }, 120_000);
});

