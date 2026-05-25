const axios = require('axios');
const db = require('../../database');
const logger = require('../../utils/logger');

const DEFAULT_API_KEY = '15d1a227b858d39e104d870d48ec1792';

function getApiKey() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'tmdb_api_key'").get();
    return row?.value || DEFAULT_API_KEY;
  } catch (err) {
    return DEFAULT_API_KEY;
  }
}

const tmdbProvider = {
  getHome: async () => {
    const apiKey = getApiKey();
    const language = 'es-ES';
    const baseUrl = 'https://api.themoviedb.org/3';

    try {
      // Fetch trending movies and tv shows
      const [moviesRes, tvRes, actionRes, comedyRes] = await Promise.all([
        axios.get(`${baseUrl}/trending/movie/week?api_key=${apiKey}&language=${language}`),
        axios.get(`${baseUrl}/trending/tv/week?api_key=${apiKey}&language=${language}`),
        axios.get(`${baseUrl}/discover/movie?api_key=${apiKey}&with_genres=28&sort_by=popularity.desc&language=${language}`),
        axios.get(`${baseUrl}/discover/movie?api_key=${apiKey}&with_genres=35&sort_by=popularity.desc&language=${language}`)
      ]);

      const formatItem = (item, type) => ({
        id: item.id,
        title: item.title || item.name || '',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
        rating: item.vote_average || 0,
        year: (item.release_date || item.first_air_date || '').split('-')[0] || '',
        type: type || item.media_type || 'movie'
      });

      return [
        {
          category: 'Películas en Tendencia',
          items: (moviesRes.data.results || []).slice(0, 15).map(i => formatItem(i, 'movie'))
        },
        {
          category: 'Series en Tendencia',
          items: (tvRes.data.results || []).slice(0, 15).map(i => formatItem(i, 'tv'))
        },
        {
          category: 'Cine de Acción',
          items: (actionRes.data.results || []).slice(0, 15).map(i => formatItem(i, 'movie'))
        },
        {
          category: 'Comedias Recomendadas',
          items: (comedyRes.data.results || []).slice(0, 15).map(i => formatItem(i, 'movie'))
        }
      ];
    } catch (err) {
      logger.error(`Error fetching TMDB home content: ${err.message}`);
      throw new Error('Error al conectar con la API de TMDB');
    }
  },

  search: async (query) => {
    const apiKey = getApiKey();
    const language = 'es-ES';
    const baseUrl = 'https://api.themoviedb.org/3';

    try {
      const [moviesRes, tvRes] = await Promise.all([
        axios.get(`${baseUrl}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=${language}`),
        axios.get(`${baseUrl}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=${language}`)
      ]);

      const formatItem = (item, type) => ({
        id: item.id,
        title: item.title || item.name || '',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
        rating: item.vote_average || 0,
        year: (item.release_date || item.first_air_date || '').split('-')[0] || '',
        type
      });

      const movies = (moviesRes.data.results || []).map(i => formatItem(i, 'movie'));
      const tvShows = (tvRes.data.results || []).map(i => formatItem(i, 'tv'));

      return [...movies, ...tvShows].sort((a, b) => b.rating - a.rating);
    } catch (err) {
      logger.error(`Error searching TMDB: ${err.message}`);
      throw new Error('Error al buscar en TMDB');
    }
  },

  getInfo: async (type, id) => {
    const apiKey = getApiKey();
    const language = 'es-ES';
    const baseUrl = 'https://api.themoviedb.org/3';

    try {
      const res = await axios.get(`${baseUrl}/${type}/${id}?api_key=${apiKey}&language=${language}`);
      const data = res.data;

      const baseInfo = {
        id: data.id,
        title: data.title || data.name || '',
        overview: data.overview || 'Sin sinopsis disponible en español.',
        poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
        backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : '',
        rating: data.vote_average || 0,
        year: (data.release_date || data.first_air_date || '').split('-')[0] || '',
        genres: (data.genres || []).map(g => g.name),
        type
      };

      if (type === 'tv') {
        // Return seasons list
        baseInfo.seasons = (data.seasons || [])
          .filter(s => s.season_number > 0) // Skip specials by default
          .map(s => ({
            season_number: s.season_number,
            name: s.name || `Temporada ${s.season_number}`,
            episode_count: s.episode_count,
            poster: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : ''
          }));
      }

      return baseInfo;
    } catch (err) {
      logger.error(`Error getting TMDB info for ${type} ${id}: ${err.message}`);
      throw new Error('Error al obtener información de TMDB');
    }
  },

  getSeasonEpisodes: async (tvId, seasonNumber) => {
    const apiKey = getApiKey();
    const language = 'es-ES';
    const baseUrl = 'https://api.themoviedb.org/3';

    try {
      const res = await axios.get(`${baseUrl}/tv/${tvId}/season/${seasonNumber}?api_key=${apiKey}&language=${language}`);
      return (res.data.episodes || []).map(e => ({
        id: e.id,
        episode_number: e.episode_number,
        name: e.name || `Episodio ${e.episode_number}`,
        overview: e.overview || '',
        still: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : '',
        air_date: e.air_date || ''
      }));
    } catch (err) {
      logger.error(`Error getting TMDB episodes for TV show ${tvId} season ${seasonNumber}: ${err.message}`);
      throw new Error('Error al obtener capítulos de la temporada');
    }
  },

  getStream: async (type, id, season = null, episode = null) => {
    // Generate streams using public resolvers
    const alt = [];
    
    if (type === 'movie') {
      alt.push({
        name: 'S1 VidSrc',
        url: `https://vidsrc.to/embed/movie/${id}`
      });
      alt.push({
        name: 'S2 VidSrc.me',
        url: `https://vidsrc.me/embed/movie?tmdb=${id}`
      });
      alt.push({
        name: 'S3 Embed.su',
        url: `https://embed.su/embed/movie/${id}`
      });
      alt.push({
        name: 'S4 2Embed',
        url: `https://www.2embed.cc/embed/${id}`
      });
      alt.push({
        name: 'S5 Smashy',
        url: `https://player.smashy.stream/movie/${id}`
      });
      alt.push({
        name: 'S6 Multi',
        url: `https://multiembed.mov/?video_id=${id}&tmdb=1`
      });
      alt.push({
        name: 'S7 Soap',
        url: `https://www.embedsoap.com/embed/movie/?id=${id}`
      });
    } else if (type === 'tv') {
      alt.push({
        name: 'S1 VidSrc',
        url: `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`
      });
      alt.push({
        name: 'S2 VidSrc.me',
        url: `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
      });
      alt.push({
        name: 'S3 Embed.su',
        url: `https://embed.su/embed/tv/${id}/${season}/${episode}`
      });
      alt.push({
        name: 'S4 2Embed',
        url: `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`
      });
      alt.push({
        name: 'S5 Smashy',
        url: `https://player.smashy.stream/tv/${id}?s=${season}&e=${episode}`
      });
      alt.push({
        name: 'S6 Multi',
        url: `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
      });
      alt.push({
        name: 'S7 Soap',
        url: `https://www.embedsoap.com/embed/tv/?id=${id}&s=${season}&e=${episode}`
      });
    }

    return {
      type: 'iframe',
      url: alt[0].url,
      alternatives: alt
    };
  }
};

module.exports = tmdbProvider;
