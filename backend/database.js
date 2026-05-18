const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'iptv.db'));
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    url TEXT UNIQUE,
    logo TEXT,
    group_title TEXT,
    tvg_id TEXT,
    country TEXT,
    language TEXT,
    is_online INTEGER DEFAULT 1,
    is_enabled INTEGER DEFAULT 1,
    is_adult INTEGER DEFAULT 0,
    access_level INTEGER DEFAULT 1, -- 0: Kids, 1: Basic, 2: Premium, 3: Adult
    status TEXT DEFAULT 'active', -- active, warning, unstable, maintenance
    fail_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS isps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    logo TEXT,
    primary_color TEXT DEFAULT '#4fc3f7',
    secondary_color TEXT DEFAULT '#1a1a1a',
    config TEXT, -- JSON config
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    is_admin INTEGER DEFAULT 0,
    isp_id INTEGER,
    max_profiles INTEGER DEFAULT 5,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(isp_id) REFERENCES isps(id)
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    type TEXT DEFAULT 'home', -- home, kids, adult
    pin_hash TEXT,
    access_level INTEGER DEFAULT 1,
    avatar TEXT,
    last_active DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    profile_id INTEGER,
    event TEXT, -- adult_unlock, login, profile_change, admin_action
    metadata TEXT, -- JSON with IP, UserAgent, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER,
    profile_id INTEGER, -- Added profile_id for per-profile favorites
    channel_id INTEGER,
    PRIMARY KEY (profile_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS m3u_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    url TEXT,
    enabled INTEGER DEFAULT 1,
    last_channels INTEGER DEFAULT 0,
    last_fetch DATETIME
  );
`);

// Add missing columns to existing tables if needed (Safe migrations)
try { db.prepare('ALTER TABLE channels ADD COLUMN is_adult INTEGER DEFAULT 0').run(); } catch(e) {}
try { db.prepare('ALTER TABLE channels ADD COLUMN access_level INTEGER DEFAULT 1').run(); } catch(e) {}
try { db.prepare('ALTER TABLE channels ADD COLUMN status TEXT DEFAULT "active"').run(); } catch(e) {}
try { db.prepare('ALTER TABLE channels ADD COLUMN success_count INTEGER DEFAULT 0').run(); } catch(e) {}
try { db.prepare('ALTER TABLE favorites ADD COLUMN profile_id INTEGER').run(); } catch(e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN isp_id INTEGER').run(); } catch(e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN max_profiles INTEGER DEFAULT 5').run(); } catch(e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1').run(); } catch(e) {}

// Seed initial ISP if none exists
const ispCount = db.prepare('SELECT COUNT(*) as count FROM isps').get().count;
if (ispCount === 0) {
  db.prepare('INSERT OR IGNORE INTO isps (name, logo) VALUES (?, ?)').run('Intertel-TV', '');
}

// Update users to link with default ISP
db.prepare('UPDATE users SET isp_id = 1 WHERE isp_id IS NULL').run();

module.exports = db;
