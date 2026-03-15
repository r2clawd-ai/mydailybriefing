const crypto = require('crypto');
const fetch = require('node-fetch');

const db = require('./db');

const TWITTER_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
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

function getTwitterConfig() {
  const {
    TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET,
    TWITTER_REDIRECT_URI,
  } = process.env;

  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET || !TWITTER_REDIRECT_URI) {
    throw new Error('Twitter OAuth environment variables are not fully configured');
  }

  return { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_REDIRECT_URI };
}

function buildBriefingRedirect(userToken, status) {
  const url = new URL(BRIEFING_REDIRECT_BASE);
  url.searchParams.set('token', userToken);
  url.searchParams.set(status, 'twitter');
  return url.toString();
}

async function exchangeTwitterToken(params) {
  const { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_REDIRECT_URI } = getTwitterConfig();
  const body = new URLSearchParams({
    client_id: TWITTER_CLIENT_ID,
    client_secret: TWITTER_CLIENT_SECRET,
    redirect_uri: TWITTER_REDIRECT_URI,
    ...params,
  });

  const response = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Twitter token exchange failed');
  }
  return payload;
}

function registerTwitterAuthRoutes(app) {
  app.get('/api/auth/twitter/start', (req, res) => {
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

      const { TWITTER_CLIENT_ID, TWITTER_REDIRECT_URI } = getTwitterConfig();
      const state = base64Url(crypto.randomBytes(24));
      const { codeVerifier, codeChallenge } = createPkcePair();

      pkceStore.set(state, {
        userToken,
        codeVerifier,
        expiresAt: Date.now() + PKCE_TTL_MS,
      });

      const authorizeUrl = new URL(TWITTER_AUTHORIZE_URL);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', TWITTER_CLIENT_ID);
      authorizeUrl.searchParams.set('redirect_uri', TWITTER_REDIRECT_URI);
      authorizeUrl.searchParams.set('scope', 'tweet.read users.read offline.access follows.read');
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('code_challenge', codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');

      res.redirect(authorizeUrl.toString());
    } catch (error) {
      console.error('Twitter OAuth start error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/twitter/callback', async (req, res) => {
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
      const tokenData = await exchangeTwitterToken({
        grant_type: 'authorization_code',
        code,
        code_verifier: stateEntry.codeVerifier,
      });

      const expiresInSeconds = Number(tokenData.expires_in || 0);
      const expiry = expiresInSeconds
        ? Date.now() + (expiresInSeconds * 1000) - 60000
        : null;

      db.updateUser(stateEntry.userToken, {
        twitter_access_token: tokenData.access_token || null,
        twitter_refresh_token: tokenData.refresh_token || null,
        twitter_token_expiry: expiry,
      });

      res.redirect(buildBriefingRedirect(stateEntry.userToken, 'connected'));
    } catch (exchangeError) {
      console.error('Twitter OAuth callback error:', exchangeError);
      res.redirect(buildBriefingRedirect(stateEntry.userToken, 'error'));
    }
  });
}

module.exports = {
  registerTwitterAuthRoutes,
  exchangeTwitterToken,
};
