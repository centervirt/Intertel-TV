const analyticsService = require('../services/analyticsService');

const analyticsController = {
  track: (req, res) => {
    const { channelId, eventType, durationSec } = req.body;
    const userId = req.user.id;

    if (!channelId || !eventType) {
      return res.status(400).json({ error: 'Missing channelId or eventType' });
    }

    analyticsService.trackEvent(userId, channelId, eventType, durationSec || 0);
    res.json({ success: true });
  }
};

module.exports = analyticsController;
