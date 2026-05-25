const vodService = require('../services/vodService');

const vodController = {
  getHome: async (req, res) => {
    try {
      const data = await vodService.getHome();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  search: async (req, res) => {
    try {
      const query = req.query.q || '';
      if (!query.trim()) {
        return res.json([]);
      }
      const data = await vodService.search(query);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getInfo: async (req, res) => {
    try {
      const { type, id } = req.params;
      const data = await vodService.getInfo(type, id);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getSeasonEpisodes: async (req, res) => {
    try {
      const { tvId, seasonNumber } = req.params;
      const data = await vodService.getSeasonEpisodes(tvId, parseInt(seasonNumber));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getStream: async (req, res) => {
    try {
      const { type, id } = req.params;
      const { season, episode } = req.query;
      const data = await vodService.getStream(
        type, 
        id, 
        season ? parseInt(season) : null, 
        episode ? parseInt(episode) : null
      );
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = vodController;
