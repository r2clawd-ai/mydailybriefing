const crypto = require('crypto');
const fetch = require('node-fetch');

const db = require('./db');

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_REDIRECT_URI = 'https://mydailybriefing-api-production.up.railway.app/api/auth/google/callback';
const BRIEFING_REDIRECT_BASE = 'https://mydailybriefing.app/briefing.html';
const PKCE_TTL_MS = 10 * 60 * 1000;
const pkceStore = new Map();

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const codeVerifier = base64Url(crypto.randomBytes(64));
  const codeChallenge = base64Url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

function cleanupExpiredPkceStates() {
  const now = Date.now();
  for (const [state, entry] of pkceStore.entries()) {
    if (entry.expiresAt <= now) {
      pkceStore.delete(state);
    }
  }
}

function getGoogleConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth environment variables are not fully configured');
  }

  return {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  };
}

function buildBriefingRedirect(userToken, status) {
  const url = new URL(BRIEFING_REDIRECT_BASE);
  url.searchParams.set('token', userToken);
  url.searchParams.set(status, 'google');
  return url.toString();
}

async function exchangeGoogleToken(params) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = getGoogleConfig();
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    ...params,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google token exchange failed');
  }
  return payload;
}

async function refreshGoogleAccessToken(userToken) {
  const user = db.getUserByToken(userToken);
  if (!user?.google_calendar_refresh_token) {
    return null;
  }

  const tokenData = await exchangeGoogleToken({
    grant_type: 'refresh_token',
    refresh_token: user.google_calendar_refresh_token,
  });

  const expiresInSeconds = Number(tokenData.expires_in || 0);
  const expiry = expiresInSeconds
    ? Date.now() + (expiresInSeconds * 1000) - 60000
    : null;

  db.updateUser(userToken, {
    google_calendar_token: tokenData.access_token || user.google_calendar_token,
    google_calendar_refresh_token: tokenData.refresh_token || user.google_calendar_refresh_token,
    google_calendar_expiry: expiry,
  });

  return db.getUserByToken(userToken);
}

function registerGoogleAuthRoutes(app) {
  app.get('/api/auth/google/start', (req, res) => {
    try {
      cleanupExpiredPkceStates();

      const userToken = req.query.token;
      if (!userToken) {
        return res.status(400).json({ error: 'token is required' });
      }

      const user = db.getUserByToken(userToken);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = getGoogleConfig();
      const state = base64Url(crypto.randomBytes(24));
      const { codeVerifier, codeChallenge } = createPkcePair();

      pkceStore.set(state, {
        userToken,
        codeVerifier,
        expiresAt: Date.now() + PKCE_TTL_MS,
      });

      const authorizeUrl = new URL(GOOGLE_AUTHORIZE_URL);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authorizeUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      authorizeUrl.searchParams.set('scope', GOOGLE_SCOPE);
      authorizeUrl.searchParams.set('access_type', 'offline');
      authorizeUrl.searchParams.set('prompt', 'consent');
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('code_challenge', codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');

      res.redirect(authorizeUrl.toString());
    } catch (error) {
      console.error('Google OAuth start error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    cleanupExpiredPkceStates();

    const { code, state, error, error_description } = req.query;
    const stateEntry = state ? pkceStore.get(state) : null;
    const fallbackToken = stateEntry?.userToken;

    if (error) {
      if (state) pkceStore.delete(state);
      if (fallbackToken) {
        return res.redirect(buildBriefingRedirect(fallbackToken, 'error'));
      }
      return res.status(400).json({ error: error_description || error });
    }

    if (!code || !state || !stateEntry || stateEntry.expiresAt <= Date.now()) {
      if (state) pkceStore.delete(state);
      return res.status(400).json({ error: 'OAuth state is invalid or expired' });
    }

    pkceStore.delete(state);

    try {
      const tokenData = await exchangeGoogleToken({
        grant_type: 'authorization_code',
        code,
        code_verifier: stateEntry.codeVerifier,
      });

      const expiresInSeconds = Number(tokenData.expires_in || 0);
      const expiry = expiresInSeconds
        ? Date.now() + (expiresInSeconds * 1000) - 60000
        : null;

      db.updateUser(stateEntry.userToken, {
        google_calendar_token: tokenData.access_token || null,
        google_calendar_refresh_token: tokenData.refresh_token || null,
        google_calendar_expiry: expiry,
      });

      res.redirect(buildBriefingRedirect(stateEntry.userToken, 'connected'));
    } catch (exchangeError) {
      console.error('Google OAuth callback error:', exchangeError);
      res.redirect(buildBriefingRedirect(stateEntry.userToken, 'error'));
    }
  });
}

module.exports = {
  exchangeGoogleToken,
  refreshGoogleAccessToken,
  registerGoogleAuthRoutes,
};
