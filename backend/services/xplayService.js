const axios = require('axios');
const db = require('../database');

const xplayService = {
  getBaseUrl: () => {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'xplay_url'").get();
    let url = setting ? setting.value : null;
    if (url && url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    return url;
  },

  authenticate: async (username, password) => {
    const baseUrl = xplayService.getBaseUrl();
    if (!baseUrl) throw new Error('XPlay URL not configured in Admin settings');
    
    const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    try {
      const res = await axios.get(url, { timeout: 10000 });
      if (res.data && res.data.user_info && res.data.user_info.auth === 1) {
        return res.data;
      }
      throw new Error('Invalid XPlay credentials');
    } catch (err) {
      if (err.response) {
        throw new Error(`XPlay API Error: ${err.response.status}`);
      }
      throw err;
    }
  },

  getLiveCategories: async (username, password) => {
    const baseUrl = xplayService.getBaseUrl();
    const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`;
    const res = await axios.get(url);
    return res.data; // Array of { category_id, category_name, parent_id }
  },

  getLiveStreams: async (username, password) => {
    const baseUrl = xplayService.getBaseUrl();
    const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
    const res = await axios.get(url);
    
    if (!Array.isArray(res.data)) return [];

    // Transform to match Intertel-TV channel format
    return res.data.map(ch => ({
      id: `xp_${ch.stream_id}`,
      name: ch.name,
      // .m3u8 works better in web browsers (Hls.js)
      url: `${baseUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${ch.stream_id}.m3u8`, 
      logo: ch.stream_icon || '',
      group_title_id: ch.category_id,
      tvg_id: ch.epg_channel_id || '',
      is_online: 1,
      is_enabled: 1,
      source: 'xplay'
    }));
  },

  getChannelsWithGroups: async (username, password) => {
    try {
      const [categories, streams] = await Promise.all([
        xplayService.getLiveCategories(username, password),
        xplayService.getLiveStreams(username, password)
      ]);
      
      const categoryMap = {};
      if (Array.isArray(categories)) {
        categories.forEach(c => {
          categoryMap[c.category_id] = c.category_name;
        });
      }

      const adultKeywords = ['xxx', 'adult', 'porn', '+18', 'erotic'];

      streams.forEach(ch => {
        const catName = categoryMap[ch.group_title_id] || 'General';
        ch.group_title = catName;
        delete ch.group_title_id;

        // Auto-detect adult
        const lowerName = ch.name.toLowerCase();
        const lowerCat = catName.toLowerCase();
        ch.is_adult = adultKeywords.some(kw => lowerName.includes(kw) || lowerCat.includes(kw)) ? 1 : 0;
      });

      return streams;
    } catch (err) {
      console.error('Error fetching XPlay channels:', err.message);
      return [];
    }
  },

  getVodHome: async (username, password) => {
    try {
      const baseUrl = xplayService.getBaseUrl();
      const catUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_categories`;
      const vodUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`;
      const seriesCatUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_categories`;
      const seriesUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`;
      
      const [categoriesRes, streamsRes, seriesCatRes, seriesRes] = await Promise.all([
        axios.get(catUrl).catch(() => ({data: []})),
        axios.get(vodUrl).catch(() => ({data: []})),
        axios.get(seriesCatUrl).catch(() => ({data: []})),
        axios.get(seriesUrl).catch(() => ({data: []}))
      ]);

      const categories = Array.isArray(categoriesRes.data) ? categoriesRes.data.slice(0, 5) : []; // Limit to 5 for home
      const streams = Array.isArray(streamsRes.data) ? streamsRes.data : [];
      const seriesCats = Array.isArray(seriesCatRes.data) ? seriesCatRes.data.slice(0, 5) : [];
      const seriesData = Array.isArray(seriesRes.data) ? seriesRes.data : [];

      const moviesData = categories.map(cat => {
        const catStreams = streams.filter(s => s.category_id === cat.category_id).slice(0, 20);
        return {
          category: cat.category_name,
          items: catStreams.map(s => ({
            id: `xp_movie_${s.stream_id}`,
            title: s.name,
            poster: s.stream_icon,
            type: 'movie',
            rating: s.rating || 0,
            year: s.year || '',
            stream_id: s.stream_id
          }))
        };
      }).filter(cat => cat.items.length > 0);

      const tvData = seriesCats.map(cat => {
        const catSeries = seriesData.filter(s => s.category_id === cat.category_id).slice(0, 20);
        return {
          category: cat.category_name,
          items: catSeries.map(s => ({
            id: `xp_tv_${s.series_id}`,
            title: s.name,
            poster: s.cover,
            type: 'tv',
            rating: s.rating || 0,
            year: s.releaseDate ? s.releaseDate.substring(0,4) : '',
            stream_id: s.series_id
          }))
        };
      }).filter(cat => cat.items.length > 0);

      return [...moviesData, ...tvData];
    } catch (err) {
      console.error('Error fetching XPlay VOD Home:', err.message);
      return [];
    }
  },

  getVodInfo: async (username, password, type, id) => {
    const baseUrl = xplayService.getBaseUrl();
    
    if (type === 'tv' || id.startsWith('xp_tv_')) {
      const series_id = id.replace('xp_tv_', '');
      const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${series_id}`;
      const res = await axios.get(url);
      const info = res.data.info || {};
      const episodes = res.data.episodes || {};
      const seasons = res.data.seasons || [];

      // Store episodes map globally or inline so getSeasonEpisodes can read it
      // XPlay API returns all episodes grouped by season number in the get_series_info call!
      if (!global.xplayEpisodesCache) global.xplayEpisodesCache = {};
      global.xplayEpisodesCache[series_id] = episodes;

      return {
        id,
        type: 'tv',
        title: info.name || '',
        overview: info.plot || '',
        poster: info.cover || '',
        backdrop: info.backdrop_path && info.backdrop_path.length > 0 ? info.backdrop_path[0] : null,
        year: info.releaseDate ? info.releaseDate.substring(0,4) : '',
        rating: info.rating ? parseFloat(info.rating) : 0,
        duration: '',
        genres: info.genre ? info.genre.split(',').map(g => g.trim()) : [],
        director: info.director || '',
        cast: info.cast ? info.cast.split(',').map(a => a.trim()) : [],
        seasons: seasons.map(s => ({
          season_number: s.season_number,
          name: s.name || `Temporada ${s.season_number}`
        })),
        stream_id: series_id
      };
    }

    const stream_id = id.replace('xp_movie_', '');
    const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_info&vod_id=${stream_id}`;
    const res = await axios.get(url);
    const info = res.data.info || {};
    const movie_data = res.data.movie_data || {};
    
    return {
      id,
      type,
      title: info.name || movie_data.name,
      overview: info.plot || '',
      poster: info.movie_image || movie_data.stream_icon,
      backdrop: info.backdrop_path ? info.backdrop_path[0] : null,
      year: info.releasedate ? info.releasedate.substring(0,4) : '',
      rating: info.rating || 0,
      duration: info.duration_secs ? Math.floor(info.duration_secs / 60) + ' min' : '',
      genres: info.genre ? info.genre.split(',').map(g => g.trim()) : [],
      director: info.director || '',
      cast: info.actors ? info.actors.split(',').map(a => a.trim()) : [],
      stream_id: stream_id
    };
  },

  getVodStreamUrl: async (username, password, id, season, episode) => {
    const baseUrl = xplayService.getBaseUrl();
    
    if (id.startsWith('xp_tv_')) {
      const series_id = id.replace('xp_tv_', '');
      const episodesMap = global.xplayEpisodesCache ? global.xplayEpisodesCache[series_id] : null;
      if (episodesMap && season && episode) {
        const eps = episodesMap[season.toString()] || [];
        const epData = eps.find(e => e.episode_num == episode);
        if (epData) {
          // XPlay series URL: /series/user/pass/id.ext
          const ext = epData.container_extension || 'mp4';
          return {
            url: `${baseUrl}/series/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${epData.id}.${ext}`
          };
        }
      }
      throw new Error('Episode stream not found');
    }

    const stream_id = id.replace('xp_movie_', '');
    // Usually .mp4 or .mkv, but XPlay standard is /movie/user/pass/id.extension
    return {
      url: `${baseUrl}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${stream_id}.mp4`
    };
  }
};

module.exports = xplayService;
