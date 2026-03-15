/**
 * social-twitter.js
 * Reads a user's real X/Twitter home timeline using their OAuth access token.
 * Uses X API v2. Falls back gracefully on any error.
 */
const fetch = require('node-fetch');
const db    = require('./db');

const X_API = 'https://api.x.com/2';

async function xFetch(path, accessToken, params = {}) {
  const url = new URL(`${X_API}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function refreshTwitterToken(userToken) {
  const user = db.getUserByToken(userToken);
  if (!user?.twitter_refresh_token) return null;
  try {
    const { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET } = process.env;
    if (!TWITTER_CLIENT_ID) return null;
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: user.twitter_refresh_token,
      client_id:     TWITTER_CLIENT_ID,
      client_secret: TWITTER_CLIENT_SECRET || '',
    });
    const res  = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) return null;
    const expiry = data.expires_in
      ? Date.now() + (data.expires_in * 1000) - 60000
      : null;
    db.updateUser(userToken, {
      twitter_access_token:  data.access_token,
      twitter_refresh_token: data.refresh_token || user.twitter_refresh_token,
      twitter_token_expiry:  expiry,
    });
    return data.access_token;
  } catch { return null; }
}

async function getTwitterTimeline(userToken, { maxResults = 20 } = {}) {
  if (!userToken) return [];
  const user = db.getUserByToken(userToken);
  if (!user?.twitter_access_token) return [];

  let accessToken = user.twitter_access_token;

  // Refresh if expired
  if (user.twitter_token_expiry && Date.now() >= user.twitter_token_expiry) {
    accessToken = await refreshTwitterToken(userToken);
    if (!accessToken) return [];
  }

  try {
    // 1. Get the authenticated user's ID
    const { status: meStatus, data: meData } = await xFetch('/users/me', accessToken);
    if (meStatus === 401) {
      // Try refresh once
      accessToken = await refreshTwitterToken(userToken);
      if (!accessToken) return [];
      const retry = await xFetch('/users/me', accessToken);
      if (retry.status !== 200) return [];
      Object.assign(meData, retry.data);
    }
    const userId = meData.data?.id;
    if (!userId) return [];

    // 2. Fetch home timeline
    const { status, data } = await xFetch(
      `/users/${userId}/timelines/reverse_chronological`,
      accessToken,
      {
        max_results:  Math.min(maxResults, 100),
        'tweet.fields': 'created_at,public_metrics,author_id',
        expansions:   'author_id',
        'user.fields': 'name,username,profile_image_url',
      }
    );

    if (status === 429) {
      console.warn('X API rate limited for user', userToken);
      return [];
    }
    if (status !== 200) return [];

    const tweets = data.data || [];
    const users  = Object.fromEntries(
      (data.includes?.users || []).map(u => [u.id, u])
    );

    return tweets.map(tweet => {
      const author = users[tweet.author_id] || {};
      return {
        id:           tweet.id,
        text:         tweet.text,
        title:        tweet.text.slice(0, 140),   // newsCard compat
        url:          `https://x.com/${author.username || 'twitter'}/status/${tweet.id}`,
        pubDate:      tweet.created_at,
        source:       `@${author.username || ''}`,
        author_name:  author.name || '',
        author_handle:`@${author.username || ''}`,
        platform:     'X',
        likes:        tweet.public_metrics?.like_count || 0,
        retweets:     tweet.public_metrics?.retweet_count || 0,
        avatar:       author.profile_image_url || null,
      };
    });
  } catch (e) {
    console.warn('Twitter timeline error:', e.message);
    return [];
  }
}

module.exports = { getTwitterTimeline, refreshTwitterToken };
