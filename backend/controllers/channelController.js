const db = require('../database');
const channelService = require('../services/channelService');

const channelController = {
  getChannels: (req, res) => {
    const { group, search, country, page = 1, limit = 50 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);
    const offset = (p - 1) * l;
    const isAdultUnlocked = req.sessionAdultUnlocked;
    const profileLevel = req.profile.accessLevel;
    const isAdultProfile = profileLevel >= 3; // Adult profile type

    let baseQuery = 'FROM channels WHERE is_enabled = 1';
    const params = [];

    // Adult content: show if profile is adult type OR adult PIN unlocked
    // Kids/Basic profiles only see adult content if PIN unlocked
    if (!isAdultUnlocked && !isAdultProfile) {
      baseQuery += ' AND is_adult = 0';
    }

    if (group) {
      baseQuery += ' AND group_title = ?';
      params.push(group);
    }
    if (country) {
      baseQuery += ' AND country = ?';
      params.push(country);
    }
    if (search) {
      baseQuery += ' AND (name LIKE ? OR group_title LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const count = db.prepare(`SELECT COUNT(*) as count ${baseQuery}`).get(...params).count;
    const query = `SELECT * ${baseQuery} ORDER BY group_title, name LIMIT ? OFFSET ?`;
    const channels = db.prepare(query).all(...params, l, offset);
    
    res.json({
      channels,
      pagination: {
        total: count,
        page: p,
        limit: l,
        pages: Math.ceil(count / l),
        hasMore: offset + channels.length < count
      }
    });
  },

  getGroups: (req, res) => {
    const isAdultUnlocked = req.sessionAdultUnlocked;
    const profileLevel = req.profile.accessLevel;
    const isAdultProfile = profileLevel >= 3;

    let query = 'SELECT group_title, COUNT(*) as count FROM channels WHERE is_enabled = 1';
    const params = [];

    if (!isAdultUnlocked && !isAdultProfile) {
      query += ' AND is_adult = 0';
    }
    query += ' GROUP BY group_title ORDER BY count DESC';
    const groups = db.prepare(query).all(...params);
    res.json(groups);
  },

  getStats: (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as count FROM channels').get().count;
    const groups = db.prepare('SELECT COUNT(DISTINCT group_title) as count FROM channels').get().count;
    const adultChannels = db.prepare('SELECT COUNT(*) as count FROM channels WHERE is_adult = 1').get().count;
    const lastLog = db.prepare('SELECT created_at FROM update_log ORDER BY created_at DESC LIMIT 1').get();
    
    res.json({ 
      total, 
      groups, 
      adultChannels,
      lastUpdate: lastLog ? lastLog.created_at : null 
    });
  },

  getEPG: (req, res) => {
    const programs = db.prepare(`
      SELECT * FROM epg_programs 
      WHERE channel_id = ? 
      AND stop > CURRENT_TIMESTAMP 
      ORDER BY start ASC 
      LIMIT 20
    `).all(req.params.channelId);
    res.json(programs);
  },

  getFavorites: (req, res) => {
    const favorites = db.prepare(`
      SELECT c.* FROM channels c 
      JOIN favorites f ON c.id = f.channel_id 
      WHERE f.user_id = ?
    `).all(req.user.id);
    res.json(favorites);
  },

  addFavorite: (req, res) => {
    try {
      db.prepare('INSERT OR IGNORE INTO favorites (user_id, channel_id) VALUES (?, ?)').run(req.user.id, req.params.channelId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  removeFavorite: (req, res) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND channel_id = ?').run(req.user.id, req.params.channelId);
    res.json({ success: true });
  }
};

module.exports = channelController;
