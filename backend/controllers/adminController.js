const db = require('../database');
const channelService = require('../services/channelService');
const analyticsService = require('../services/analyticsService');
const alertService = require('../services/alertService');

const adminController = {
  getStats: (req, res) => {
    const stats = {
      totalChannels: db.prepare('SELECT COUNT(*) as count FROM channels').get().count,
      adultChannels: db.prepare('SELECT COUNT(*) as count FROM channels WHERE is_adult = 1').get().count,
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      totalGroups: db.prepare('SELECT COUNT(DISTINCT group_title) as count FROM channels').get().count,
      totalSources: db.prepare('SELECT COUNT(*) as count FROM m3u_sources').get().count,
      lastUpdate: db.prepare('SELECT created_at FROM update_log ORDER BY created_at DESC LIMIT 1').get()?.created_at,
      recentLogs: db.prepare('SELECT * FROM update_log ORDER BY created_at DESC LIMIT 10').all(),
      topGroups: db.prepare('SELECT group_title, COUNT(*) as count FROM channels GROUP BY group_title ORDER BY count DESC LIMIT 5').all()
    };
    res.json(stats);
  },

  getSources: (req, res) => {
    const sources = db.prepare('SELECT * FROM m3u_sources').all();
    res.json(sources);
  },

  createSource: (req, res) => {
    const { name, url } = req.body;
    try {
      db.prepare('INSERT INTO m3u_sources (name, url) VALUES (?, ?)').run(name, url);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Source URL already exists' });
    }
  },

  updateSource: (req, res) => {
    const { name, url, enabled } = req.body;
    db.prepare('UPDATE m3u_sources SET name = COALESCE(?, name), url = COALESCE(?, url), enabled = COALESCE(?, enabled) WHERE id = ?')
      .run(name, url, enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.id);
    res.json({ success: true });
  },

  deleteSource: (req, res) => {
    db.prepare('DELETE FROM m3u_sources WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  },

  refreshChannels: (req, res) => {
    if (channelService.getIsUpdating()) return res.status(409).json({ error: 'Update already in progress' });
    channelService.updateChannels();
    res.json({ message: 'Update started' });
  },

  getDashboardData: (req, res) => {
    const data = {
      metrics: {
        concurrentViewers: analyticsService.getConcurrentViewers(),
        dailyMinutes: analyticsService.getDailyConsumption(),
        totalChannels: db.prepare('SELECT COUNT(*) as count FROM channels').get().count,
        adultChannels: db.prepare('SELECT COUNT(*) as count FROM channels WHERE is_adult = 1').get().count,
        offlineChannels: db.prepare('SELECT COUNT(*) as count FROM channels WHERE is_online = 0').get().count,
        maintenanceChannels: db.prepare("SELECT COUNT(*) as count FROM channels WHERE is_enabled = 0 OR status = 'maintenance'").get().count,
      },
      topChannels: analyticsService.getPopularChannels(5),
      streamErrors: analyticsService.getStreamErrors(5),
      alerts: alertService.getUnreadAlerts().slice(0, 5),
      recentLogs: db.prepare('SELECT * FROM update_log ORDER BY created_at DESC LIMIT 5').all()
    };
    res.json(data);
  }
};

module.exports = adminController;
