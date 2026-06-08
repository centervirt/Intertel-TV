const vodService = require('../services/vodService');
const xplayService = require('../services/xplayService');

const vodController = {
  getHome: async (req, res) => {
    try {
      if (req.user && req.user.type === 'xplay') {
        const data = await xplayService.getVodHome(req.user.username, req.user.password);
        return res.json(data);
      }
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
      if (req.user && req.user.type === 'xplay' && id.startsWith('xp_')) {
        const data = await xplayService.getVodInfo(req.user.username, req.user.password, type, id);
        return res.json(data);
      }
      const data = await vodService.getInfo(type, id);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getSeasonEpisodes: async (req, res) => {
    try {
      const { tvId, seasonNumber } = req.params;
      if (req.user && req.user.type === 'xplay' && tvId.startsWith('xp_tv_')) {
        const series_id = tvId.replace('xp_tv_', '');
        const episodesMap = global.xplayEpisodesCache ? global.xplayEpisodesCache[series_id] : null;
        if (episodesMap) {
          // XPlay episodes are grouped by season string/number, e.g., episodesMap["1"]
          const eps = episodesMap[seasonNumber.toString()] || [];
          const formatted = eps.map(ep => ({
            id: `xp_ep_${ep.id}`,
            episode_number: ep.episode_num,
            name: ep.title || `Episodio ${ep.episode_num}`,
            overview: ep.info?.plot || '',
            still: ep.info?.movie_image || '',
            duration: ep.info?.duration_secs ? Math.floor(ep.info.duration_secs / 60) + ' min' : '',
            stream_id: ep.id // This is the actual stream_id for the episode!
          }));
          return res.json(formatted);
        }
        return res.json([]);
      }
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
      
      if (req.user && req.user.type === 'xplay' && id.startsWith('xp_')) {
        const data = await xplayService.getVodStreamUrl(req.user.username, req.user.password, id, season, episode);
        return res.json(data);
      }

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
