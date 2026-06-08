const db = require('../database');
const channelService = require('../services/channelService');
const xplayService = require('../services/xplayService');

// Pre-compiled query for current EPG program
const getCurrentEpgProgram = db.prepare(`
  SELECT title, start, stop, description 
  FROM epg_programs 
  WHERE channel_id = ? 
  AND start <= ? AND stop >= ? 
  ORDER BY start DESC 
  LIMIT 1
`);

function getMockProgram(channelId, channelName, groupTitle) {
  // Use a hash of the channelName to ensure the schedule is consistent/stable throughout the day
  let hash = 0;
  for (let i = 0; i < channelName.length; i++) {
    hash = channelName.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const now = new Date();
  const currentHour = now.getHours();
  
  // Programs last 2 hours
  const startHour = Math.floor(currentHour / 2) * 2;
  const start = new Date(now);
  start.setHours(startHour, 0, 0, 0);
  
  const stop = new Date(start);
  stop.setHours(startHour + 2, 0, 0, 0);

  // Generate title based on group or name
  let title = '';
  let description = '';
  const group = (groupTitle || 'General').toLowerCase();

  if (group.includes('cine') || group.includes('película') || group.includes('movie') || group.includes('cinema')) {
    const movies = [
      'Maratón de Cine de Acción', 'Película Taquillera del Mes', 'Cine Clásico del Recuerdo',
      'Festival de Ciencia Ficción', 'Especial de Comedia Romántica', 'Tarde de Suspenso y Terror'
    ];
    title = movies[hash % movies.length];
    description = 'Disfruta de la mejor selección de películas de este género, sin cortes comerciales.';
  } else if (group.includes('serie')) {
    const series = [
      'Maratón de Series Populares', 'Especial de Comedia de Situación', 'Serie de Misterio e Intriga',
      'Capítulos Estreno en Continuo', 'Series de Culto de los 90s', 'Drama y Acción sin Límites'
    ];
    title = series[hash % series.length];
    description = 'Todos los episodios en continuado de tus producciones de TV favoritas.';
  } else if (group.includes('deporte') || group.includes('sport') || group.includes('futbol') || group.includes('soccer')) {
    const sports = [
      'Resumen de la Fecha Deportiva', 'Fútbol en Vivo y en Directo', 'Especial: Grandes Leyendas',
      'Mundo Extremo y Deportes de Aventura', 'Análisis Deportivo y Debate', 'Polideportivo 24/7'
    ];
    title = sports[hash % sports.length];
    description = 'Toda la pasión de tus deportes favoritos, con transmisiones y análisis en vivo.';
  } else if (group.includes('infantil') || group.includes('niño') || group.includes('kid') || group.includes('animation')) {
    const kids = [
      'Club de Dibujos Animados', 'Aventuras Infantiles Divertidas', 'Series y Cuentos Educativos',
      'Anime y Animación Especial', 'Tarde de Caricaturas Clásicas', 'El Show de los Más Chicos'
    ];
    title = kids[hash % kids.length];
    description = 'Programación sana, educativa y divertida para los niños del hogar.';
  } else if (group.includes('noticia') || group.includes('news')) {
    const news = [
      'Noticiero Central 24hs', 'El Mundo Hoy: Resumen Informativo', 'Debate y Opinión Internacional',
      'Economía y Tendencias Globales', 'Alerta de Noticias en Vivo', 'Entrevistas de Actualidad'
    ];
    title = news[hash % news.length];
    description = 'Toda la actualidad, noticias de último momento y cobertura internacional en directo.';
  } else if (group.includes('música') || group.includes('music')) {
    const music = [
      'Éxitos Pop y Urbanos del Momento', 'Clásicos del Rock en Español', 'Lo-Fi Chill & Relax Beats',
      'Música Electrónica y Clubbing', 'Top 40 Videos de la Semana', 'Transmisión Especial de Conciertos'
    ];
    title = music[hash % music.length];
    description = 'La mejor selección musical en continuado, playlists temáticas y videos en vivo.';
  } else if (channelName.toLowerCase().includes('one piece')) {
    title = 'One Piece - Transmisión Continua 24hs';
    description = 'Maratón de todos los arcos del legendario anime de piratas de Eiichiro Oda.';
  } else {
    const generals = [
      'Transmisión General Especial', 'Magazine de Entretenimiento', 'Cultura y Estilo de Vida',
      'Show de Variedades y Tendencias', 'Especial del Canal en Directo', 'Espacio de Entretenimiento'
    ];
    title = `${generals[hash % generals.length]} en ${channelName}`;
    description = 'Toda la programación regular y cobertura de entretenimiento de esta señal.';
  }

  return {
    title,
    start: start.toISOString(),
    stop: stop.toISOString(),
    description
  };
}

function attachEpgData(channels) {
  const nowStr = new Date().toISOString();
  return channels.map(ch => {
    const epg = ch.tvg_id ? getCurrentEpgProgram.get(ch.tvg_id, nowStr, nowStr) : null;
    if (epg) {
      return {
        ...ch,
        epg: {
          title: epg.title,
          start: epg.start,
          stop: epg.stop,
          description: epg.description
        }
      };
    } else {
      return {
        ...ch,
        epg: getMockProgram(ch.id, ch.name, ch.group_title)
      };
    }
  });
}

const channelController = {
  getChannels: async (req, res) => {
    const { group, search, country, page = 1, limit = 50 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);
    const offset = (p - 1) * l;
    const isAdultUnlocked = req.sessionAdultUnlocked;
    const profileLevel = req.profile.accessLevel;
    const profileType = req.profile.type;
    const isAdultProfile = (profileLevel >= 3 && profileType === 'adult');

    if (req.user && req.user.type === 'xplay') {
      try {
        const allChannels = await xplayService.getChannelsWithGroups(req.user.username, req.user.password);
        let filtered = allChannels;
        
        if (!isAdultUnlocked && !isAdultProfile) {
          filtered = filtered.filter(c => c.is_adult === 0);
        }
        if (group) {
          filtered = filtered.filter(c => c.group_title === group);
        }
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter(c => c.name.toLowerCase().includes(s) || c.group_title.toLowerCase().includes(s));
        }
        
        const count = filtered.length;
        const paginated = filtered.slice(offset, offset + l);
        
        return res.json({
          channels: attachEpgData(paginated),
          pagination: {
            total: count,
            page: p,
            limit: l,
            pages: Math.ceil(count / l),
            hasMore: offset + paginated.length < count
          }
        });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch from XPlay' });
      }
    }

    let baseQuery = `
      FROM channels c
      LEFT JOIN group_settings gs ON c.group_title = gs.original_name
      WHERE c.is_enabled = 1 AND (gs.is_hidden IS NULL OR gs.is_hidden = 0)
    `;
    const params = [];

    if (!isAdultUnlocked && !isAdultProfile) {
      baseQuery += ' AND c.is_adult = 0';
    }

    if (group) {
      baseQuery += ' AND (c.group_title = ? OR gs.display_name = ?)';
      params.push(group, group);
    }
    if (country) {
      baseQuery += ' AND c.country = ?';
      params.push(country);
    }
    if (search) {
      baseQuery += ' AND (c.name LIKE ? OR c.group_title LIKE ? OR gs.display_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const count = db.prepare(`SELECT COUNT(*) as count ${baseQuery}`).get(...params).count;
    const query = `
      SELECT 
        c.*,
        COALESCE(gs.display_name, c.group_title) as group_title
      ${baseQuery} 
      ORDER BY COALESCE(gs.sort_order, 0) ASC, COALESCE(gs.display_name, c.group_title) ASC, c.name ASC 
      LIMIT ? OFFSET ?
    `;
    const channels = db.prepare(query).all(...params, l, offset);
    
    res.json({
      channels: attachEpgData(channels),
      pagination: {
        total: count,
        page: p,
        limit: l,
        pages: Math.ceil(count / l),
        hasMore: offset + channels.length < count
      }
    });
  },

  getGroups: async (req, res) => {
    const isAdultUnlocked = req.sessionAdultUnlocked;
    const profileLevel = req.profile.accessLevel;
    const profileType = req.profile.type;
    const isAdultProfile = (profileLevel >= 3 && profileType === 'adult');

    if (req.user && req.user.type === 'xplay') {
      try {
        const allChannels = await xplayService.getChannelsWithGroups(req.user.username, req.user.password);
        const groupsMap = {};
        allChannels.forEach(c => {
          if (!isAdultUnlocked && !isAdultProfile && c.is_adult === 1) return;
          if (!groupsMap[c.group_title]) {
            groupsMap[c.group_title] = 0;
          }
          groupsMap[c.group_title]++;
        });
        
        const groups = Object.keys(groupsMap).map(g => ({
          group_title: g,
          count: groupsMap[g],
          display_name: g,
          is_hidden: 0,
          sort_order: 0
        })).sort((a,b) => a.group_title.localeCompare(b.group_title));
        
        return res.json(groups);
      } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch from XPlay' });
      }
    }

    let query = `
      SELECT 
        c.group_title, 
        COUNT(c.id) as count,
        gs.display_name,
        COALESCE(gs.is_hidden, 0) as is_hidden,
        COALESCE(gs.sort_order, 0) as sort_order
      FROM channels c
      LEFT JOIN group_settings gs ON c.group_title = gs.original_name
      WHERE c.is_enabled = 1 AND (gs.is_hidden IS NULL OR gs.is_hidden = 0)
    `;
    const params = [];

    if (!isAdultUnlocked && !isAdultProfile) {
      query += ' AND c.is_adult = 0';
    }
    query += ' GROUP BY c.group_title ORDER BY sort_order ASC, count DESC';
    const rawGroups = db.prepare(query).all(...params);
    
    const groups = rawGroups.map(g => ({
      group_title: g.display_name || g.group_title,
      original_group_title: g.group_title,
      count: g.count
    }));

    res.json(groups);
  },

  getStats: (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as count FROM channels').get().count;
    const groups = db.prepare('SELECT COUNT(DISTINCT group_title) as count FROM channels').get().count;
    const adultChannels = db.prepare('SELECT COUNT(*) as count FROM channels WHERE is_adult = 1').get().count;
    const lastLog = db.prepare('SELECT created_at FROM update_log ORDER BY created_at DESC LIMIT 1').get();
    
    res.json({ 
      total, 
      groups, 
      adultChannels,
      lastUpdate: lastLog ? lastLog.created_at : null 
    });
  },

  getEPG: (req, res) => {
    const programs = db.prepare(`
      SELECT * FROM epg_programs 
      WHERE channel_id = ? 
      AND stop > CURRENT_TIMESTAMP 
      ORDER BY start ASC 
      LIMIT 20
    `).all(req.params.channelId);
    res.json(programs);
  },

  getFavorites: (req, res) => {
    const isAdultUnlocked = req.sessionAdultUnlocked;
    const profileLevel = req.profile.accessLevel;
    const isAdultProfile = profileLevel >= 3;

    let query = `
      SELECT c.* FROM channels c 
      JOIN favorites f ON c.id = f.channel_id 
      WHERE f.profile_id = ?
    `;
    
    if (!isAdultUnlocked && !isAdultProfile) {
      query += ' AND c.is_adult = 0';
    }

    try {
      const favorites = db.prepare(query).all(req.profile.id);
      res.json(attachEpgData(favorites));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  addFavorite: (req, res) => {
    try {
      db.prepare('INSERT OR IGNORE INTO favorites (user_id, profile_id, channel_id) VALUES (?, ?, ?)')
        .run(req.user.id, req.profile.id, req.params.channelId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  removeFavorite: (req, res) => {
    try {
      db.prepare('DELETE FROM favorites WHERE profile_id = ? AND channel_id = ?')
        .run(req.profile.id, req.params.channelId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = channelController;
