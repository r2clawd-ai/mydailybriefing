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
    stocks      TEXT DEFAULT '[]',
    hs_teams    TEXT DEFAULT '[]',
    created_at  TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL
  )
`);

// ---------- Helpers ----------

function parseUser(row) {
  if (!row) return null;
  return {
    ...row,
    interests:       JSON.parse(row.interests       || '[]'),
    sports_teams:    JSON.parse(row.sports_teams    || '[]'),
    celeb_topics:    JSON.parse(row.celeb_topics    || '[]'),
    twitter_handles: JSON.parse(row.twitter_handles || '[]'),
    stocks:          JSON.parse(row.stocks          || '[]'),
    hs_teams:        JSON.parse(row.hs_teams        || '[]'),
  };
}

// ---------- Statements ----------

const stmtInsert = db.prepare(`
  INSERT INTO users (id, email, zip_code, city, state, lat, lng,
    interests, sports_teams, celeb_topics, twitter_handles, stocks, hs_teams,
    created_at, token)
  VALUES (@id, @email, @zip_code, @city, @state, @lat, @lng,
    @interests, @sports_teams, @celeb_topics, @twitter_handles, @stocks, @hs_teams,
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
    stocks          = COALESCE(@stocks, stocks),
    hs_teams        = COALESCE(@hs_teams, hs_teams)
  WHERE token = @token
`);

// ---------- Exports ----------

function createUser({ email, zip_code, city, state, lat, lng,
                       interests = [], sports_teams = [], celeb_topics = [],
                       twitter_handles = [], stocks = [], hs_teams = [] }) {
  const id    = uuidv4();
  const token = uuidv4();
  const now   = new Date().toISOString();

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
    stocks:          JSON.stringify(stocks),
    hs_teams:        JSON.stringify(hs_teams),
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
  if (fields.stocks          !== undefined) patch.stocks          = JSON.stringify(fields.stocks);
  if (fields.hs_teams        !== undefined) patch.hs_teams        = JSON.stringify(fields.hs_teams);

  stmtUpdate.run({ ...patch, token });
  return parseUser(stmtByToken.get(token));
}

module.exports = { db, createUser, getUserByToken, getUserByEmail, updateUser };
