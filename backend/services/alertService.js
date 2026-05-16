const db = require('../database');
const logger = require('../utils/logger');

const alertService = {
  createAlert: (message, level = 'info') => {
    try {
      db.prepare('INSERT INTO alerts (message, level) VALUES (?, ?)').run(message, level);
      logger.info(`New alert [${level}]: ${message}`);
    } catch (err) {
      logger.error(`Error creating alert: ${err.message}`);
    }
  },

  getUnreadAlerts: () => {
    return db.prepare('SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC').all();
  },

  markAsRead: (id) => {
    db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
  },

  clearOldAlerts: (days = 7) => {
    db.prepare("DELETE FROM alerts WHERE created_at < datetime('now', '-' || ? || ' days')").run(days);
  }
};

module.exports = alertService;
