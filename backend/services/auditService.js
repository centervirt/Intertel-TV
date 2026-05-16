const db = require('../database');

const auditService = {
  logEvent: (userId, profileId, event, req) => {
    try {
      const metadata = JSON.stringify({
        ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        url: req.originalUrl,
        method: req.method
      });

      db.prepare(`
        INSERT INTO audit_logs (user_id, profile_id, event, metadata)
        VALUES (?, ?, ?, ?)
      `).run(userId, profileId || null, event, metadata);
    } catch (err) {
      console.error('Audit Log Error:', err);
    }
  },

  getLogs: (limit = 100) => {
    return db.prepare(`
      SELECT l.*, u.username, p.name as profile_name 
      FROM audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN profiles p ON l.profile_id = p.id
      ORDER BY l.created_at DESC LIMIT ?
    `).all(limit);
  }
};

module.exports = auditService;
