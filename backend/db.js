/**
 * db.js - SQLite user store via better-sqlite3
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'briefing.db');

// Open / create database
const db = new Database(DB_PATH);

// Enable WAL for better concurrency
db.pragma('journal_mode = WAL');

function addColumnIfMissing(columnSql) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${columnSql}`);
  } catch (error) {
    if (!/duplicate column name/i.test(error.message)) {
      throw error;
    }
  }
}

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    zip_code    TEXT NOT NULL,
    city        TEXT,
    state       TEXT,
    lat         REAL,
    lng         REAL,
    interests   TEXT DEFAULT '[]',
    sports_teams TEXT DEFAULT '[]',
    celeb_topics TEXT DEFAULT '[]',
    twitter_handles TEXT DEFAULT '[]',
    twitter_access_token TEXT,
    twitter_refresh_token TEXT,
    twitter_token_expiry INTEGER,
    google_calendar_token TEXT,
    google_calendar_refresh_token TEXT,
    google_calendar_expiry INTEGER,
    calendar_ics_url TEXT,
    substack_feeds TEXT DEFAULT '[]',
    is_pro INTEGER DEFAULT 0,
    pro_expires_at TEXT,
    stocks      TEXT DEFAULT '[]',
    hs_teams    TEXT DEFAULT '[]',
    saved_locations TEXT DEFAULT '[]',
    created_at  TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL
  )
`);

[
  'twitter_access_token TEXT',
  'twitter_refresh_token TEXT',
  'twitter_token_expiry INTEGER',
  'google_calendar_token TEXT',
  'google_calendar_refresh_token TEXT',
  'google_calendar_expiry INTEGER',
  'calendar_ics_url TEXT',
  `substack_feeds TEXT DEFAULT '[]'`,
  'is_pro INTEGER DEFAULT 0',
  'pro_expires_at TEXT',
  `saved_locations TEXT DEFAULT '[]'`,
  'stripe_customer_id TEXT',
  'subscription_status TEXT',
  'subscription_id TEXT',
  'subscription_end INTEGER',
].forEach(addColumnIfMissing);

function parseJsonArray(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

// ---------- Helpers ----------

function parseUser(row) {
  if (!row) return null;
  return {
    ...row,
    interests:       parseJsonArray(row.interests),
    sports_teams:    parseJsonArray(row.sports_teams),
    celeb_topics:    parseJsonArray(row.celeb_topics),
    twitter_handles: parseJsonArray(row.twitter_handles),
    substack_feeds:  parseJsonArray(row.substack_feeds),
    stocks:          parseJsonArray(row.stocks),
    hs_teams:        parseJsonArray(row.hs_teams),
    saved_locations: parseJsonArray(row.saved_locations),
    is_pro:          Boolean(row.is_pro),
  };
}

// ---------- Statements ----------

const stmtInsert = db.prepare(`
  INSERT INTO users (id, email, zip_code, city, state, lat, lng,
    interests, sports_teams, celeb_topics, twitter_handles,
    twitter_access_token, twitter_refresh_token, twitter_token_expiry,
    google_calendar_token, google_calendar_refresh_token, google_calendar_expiry, calendar_ics_url,
    substack_feeds, is_pro, pro_expires_at, stocks, hs_teams, saved_locations,
    created_at, token)
  VALUES (@id, @email, @zip_code, @city, @state, @lat, @lng,
    @interests, @sports_teams, @celeb_topics, @twitter_handles,
    @twitter_access_token, @twitter_refresh_token, @twitter_token_expiry,
    @google_calendar_token, @google_calendar_refresh_token, @google_calendar_expiry, @calendar_ics_url,
    @substack_feeds, @is_pro, @pro_expires_at, @stocks, @hs_teams, @saved_locations,
    @created_at, @token)
`);

const stmtByToken  = db.prepare('SELECT * FROM users WHERE token = ?');
const stmtByEmail  = db.prepare('SELECT * FROM users WHERE email = ?');

const stmtUpdate = db.prepare(`
  UPDATE users SET
    zip_code        = COALESCE(@zip_code, zip_code),
    city            = COALESCE(@city, city),
    state           = COALESCE(@state, state),
    lat             = COALESCE(@lat, lat),
    lng             = COALESCE(@lng, lng),
    interests       = COALESCE(@interests, interests),
    sports_teams    = COALESCE(@sports_teams, sports_teams),
    celeb_topics    = COALESCE(@celeb_topics, celeb_topics),
    twitter_handles = COALESCE(@twitter_handles, twitter_handles),
    twitter_access_token = COALESCE(@twitter_access_token, twitter_access_token),
    twitter_refresh_token = COALESCE(@twitter_refresh_token, twitter_refresh_token),
    twitter_token_expiry = COALESCE(@twitter_token_expiry, twitter_token_expiry),
    google_calendar_token = COALESCE(@google_calendar_token, google_calendar_token),
    google_calendar_refresh_token = COALESCE(@google_calendar_refresh_token, google_calendar_refresh_token),
    google_calendar_expiry = COALESCE(@google_calendar_expiry, google_calendar_expiry),
    calendar_ics_url = COALESCE(@calendar_ics_url, calendar_ics_url),
    substack_feeds  = COALESCE(@substack_feeds, substack_feeds),
    is_pro          = COALESCE(@is_pro, is_pro),
    pro_expires_at  = COALESCE(@pro_expires_at, pro_expires_at),
    stocks          = COALESCE(@stocks, stocks),
    hs_teams        = COALESCE(@hs_teams, hs_teams),
    saved_locations = COALESCE(@saved_locations, saved_locations)
  WHERE token = @token
`);

// ---------- Exports ----------

function createUser({ email, zip_code, city, state, lat, lng,
                       interests = [], sports_teams = [], celeb_topics = [],
                       twitter_handles = [], twitter_access_token = null,
                       twitter_refresh_token = null, twitter_token_expiry = null,
                       google_calendar_token = null, google_calendar_refresh_token = null,
                       google_calendar_expiry = null, calendar_ics_url = null,
                       substack_feeds = [], is_pro = false, pro_expires_at = null,
                       stocks = [], hs_teams = [], saved_locations = [] }) {
  const id    = uuidv4();
  const token = uuidv4();
  const now   = new Date().toISOString();

  const homeLoc = city && state
    ? [{ zip: zip_code, label: 'Home', city, state }]
    : [];
  const locs = saved_locations.length ? saved_locations : homeLoc;

  stmtInsert.run({
    id, email, zip_code,
    city:            city    || null,
    state:           state   || null,
    lat:             lat     || null,
    lng:             lng     || null,
    interests:       JSON.stringify(interests),
    sports_teams:    JSON.stringify(sports_teams),
    celeb_topics:    JSON.stringify(celeb_topics),
    twitter_handles: JSON.stringify(twitter_handles),
    twitter_access_token,
    twitter_refresh_token,
    twitter_token_expiry,
    google_calendar_token,
    google_calendar_refresh_token,
    google_calendar_expiry,
    calendar_ics_url,
    substack_feeds:  JSON.stringify(substack_feeds),
    is_pro:          is_pro ? 1 : 0,
    pro_expires_at,
    stocks:          JSON.stringify(stocks),
    hs_teams:        JSON.stringify(hs_teams),
    saved_locations: JSON.stringify(locs),
    created_at: now,
    token,
  });

  return parseUser(stmtByToken.get(token));
}

function getUserByToken(token) {
  return parseUser(stmtByToken.get(token));
}

function getUserByEmail(email) {
  return parseUser(stmtByEmail.get(email));
}

function updateUser(token, fields) {
  const patch = {};
  if (fields.zip_code        !== undefined) patch.zip_code        = fields.zip_code;
  if (fields.city            !== undefined) patch.city            = fields.city;
  if (fields.state           !== undefined) patch.state           = fields.state;
  if (fields.lat             !== undefined) patch.lat             = fields.lat;
  if (fields.lng             !== undefined) patch.lng             = fields.lng;
  if (fields.interests       !== undefined) patch.interests       = JSON.stringify(fields.interests);
  if (fields.sports_teams    !== undefined) patch.sports_teams    = JSON.stringify(fields.sports_teams);
  if (fields.celeb_topics    !== undefined) patch.celeb_topics    = JSON.stringify(fields.celeb_topics);
  if (fields.twitter_handles !== undefined) patch.twitter_handles = JSON.stringify(fields.twitter_handles);
  if (fields.twitter_access_token !== undefined) patch.twitter_access_token = fields.twitter_access_token;
  if (fields.twitter_refresh_token !== undefined) patch.twitter_refresh_token = fields.twitter_refresh_token;
  if (fields.twitter_token_expiry !== undefined) patch.twitter_token_expiry = fields.twitter_token_expiry;
  if (fields.google_calendar_token !== undefined) patch.google_calendar_token = fields.google_calendar_token;
  if (fields.google_calendar_refresh_token !== undefined) patch.google_calendar_refresh_token = fields.google_calendar_refresh_token;
  if (fields.google_calendar_expiry !== undefined) patch.google_calendar_expiry = fields.google_calendar_expiry;
  if (fields.calendar_ics_url !== undefined) patch.calendar_ics_url = fields.calendar_ics_url;
  if (fields.substack_feeds  !== undefined) patch.substack_feeds  = JSON.stringify(fields.substack_feeds);
  if (fields.is_pro          !== undefined) patch.is_pro          = fields.is_pro ? 1 : 0;
  if (fields.pro_expires_at  !== undefined) patch.pro_expires_at  = fields.pro_expires_at;
  if (fields.stocks          !== undefined) patch.stocks          = JSON.stringify(fields.stocks);
  if (fields.hs_teams        !== undefined) patch.hs_teams        = JSON.stringify(fields.hs_teams);
  if (fields.saved_locations !== undefined) patch.saved_locations = JSON.stringify(fields.saved_locations);

  stmtUpdate.run({ ...patch, token });
  return parseUser(stmtByToken.get(token));
}

module.exports = { db, createUser, getUserByToken, getUserByEmail, updateUser };
