const db = require('../database');
const tmdbProvider = require('./vodProviders/tmdbProvider');
const logger = require('../utils/logger');

function getProvider() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'vod_provider'").get();
    const providerName = row?.value || 'tmdb';
    
    if (providerName === 'tmdb') {
      return tmdbProvider;
    }
    
    // In the future:
    // if (providerName === 'xtream') return xtreamProvider;
    // if (providerName === 'jellyfin') return jellyfinProvider;
    
    return tmdbProvider;
  } catch (err) {
    return tmdbProvider;
  }
}

const vodService = {
  getHome: async () => {
    return getProvider().getHome();
  },

  search: async (query) => {
    return getProvider().search(query);
  },

  getInfo: async (type, id) => {
    return getProvider().getInfo(type, id);
  },

  getSeasonEpisodes: async (tvId, seasonNumber) => {
    const provider = getProvider();
    if (provider.getSeasonEpisodes) {
      return provider.getSeasonEpisodes(tvId, seasonNumber);
    }
    return [];
  },

  getStream: async (type, id, season = null, episode = null) => {
    return getProvider().getStream(type, id, season, episode);
  }
};

module.exports = vodService;
