const db = require('../database');
const logger = require('../utils/logger');

const analyticsService = {
  trackEvent: (userId, channelId, eventType, durationSec = 0) => {
    try {
      db.prepare(`
        INSERT INTO analytics_events (user_id, channel_id, event_type, duration_sec)
        VALUES (?, ?, ?, ?)
      `).run(userId, channelId, eventType, durationSec);

      if (eventType === 'play' || eventType === 'heartbeat') {
        // Update active session
        const session = db.prepare('SELECT id FROM active_sessions WHERE user_id = ?').get(userId);
        if (session) {
          db.prepare('UPDATE active_sessions SET channel_id = ?, last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?')
            .run(channelId, session.id);
        } else {
          db.prepare('INSERT INTO active_sessions (user_id, channel_id) VALUES (?, ?)')
            .run(userId, channelId);
        }
      }

      if (eventType === 'error') {
        // Increment fail_count in channels
        db.prepare('UPDATE channels SET fail_count = fail_count + 1 WHERE id = ?').run(channelId);
      }
    } catch (err) {
      logger.error(`Error tracking event: ${err.message}`);
    }
  },

  cleanupSessions: () => {
    try {
      // Remove sessions with no heartbeat in the last 2 minutes
      const result = db.prepare("DELETE FROM active_sessions WHERE last_heartbeat < datetime('now', '-2 minutes')").run();
      if (result.changes > 0) {
        logger.info(`Cleaned up ${result.changes} inactive sessions.`);
      }
    } catch (err) {
      logger.error(`Error cleaning up sessions: ${err.message}`);
    }
  },

  getConcurrentViewers: () => {
    return db.prepare('SELECT COUNT(*) as count FROM active_sessions').get().count;
  },

  getDailyConsumption: () => {
    return db.prepare(`
      SELECT SUM(duration_sec) / 60 as minutes 
      FROM analytics_events 
      WHERE event_type = 'heartbeat' 
      AND created_at > date('now')
    `).get().minutes || 0;
  },

  getPopularChannels: (limit = 10) => {
    return db.prepare(`
      SELECT c.name, COUNT(e.id) as plays 
      FROM channels c 
      JOIN analytics_events e ON c.id = e.channel_id 
      WHERE e.event_type = 'play' 
      GROUP BY c.id 
      ORDER BY plays DESC 
      LIMIT ?
    `).all(limit);
  },

  getStreamErrors: (limit = 5) => {
    return db.prepare(`
      SELECT c.name, COUNT(e.id) as errors 
      FROM channels c 
      JOIN analytics_events e ON c.id = e.channel_id 
      WHERE e.event_type = 'error' 
      GROUP BY c.id 
      ORDER BY errors DESC 
      LIMIT ?
    `).all(limit);
  }
};

module.exports = analyticsService;
