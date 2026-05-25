const axios = require('axios');
const db = require('../database');
const { parseM3U } = require('../parsers/m3uParser');
const logger = require('../utils/logger');
const { parseEPG } = require('../parsers/epgParser');
const zlib = require('zlib');

let isUpdating = false;

async function updateEPG(epgUrls) {
  if (!epgUrls || epgUrls.size === 0) {
    logger.info('No se encontraron URLs de EPG para procesar.');
    return;
  }

  logger.info(`Iniciando la actualización de EPG para ${epgUrls.size} fuentes...`);
  let allPrograms = [];

  for (const url of epgUrls) {
    try {
      logger.info(`Descargando EPG desde: ${url}`);
      const response = await axios.get(url, { 
        timeout: 60000, 
        responseType: 'arraybuffer',
        headers: {
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });

      const buffer = Buffer.from(response.data);
      let xmlContent;

      // Sniff magic bytes (0x1f 0x8b) for gzip or check url ending
      if ((buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) || url.toLowerCase().endsWith('.gz')) {
        logger.info('El archivo EPG está comprimido con gzip. Descomprimiendo...');
        xmlContent = zlib.gunzipSync(buffer).toString('utf-8');
      } else {
        xmlContent = buffer.toString('utf-8');
      }

      logger.info('Parseando el contenido XML del EPG...');
      const programs = parseEPG(xmlContent);
      logger.info(`Se parsearon ${programs.length} programas del EPG.`);
      allPrograms = allPrograms.concat(programs);
    } catch (err) {
      logger.error(`Error al procesar EPG desde ${url}: ${err.message}`);
    }
  }

  if (allPrograms.length > 0) {
    logger.info(`Insertando ${allPrograms.length} programas de EPG en la base de datos...`);
    try {
      const insertEpg = db.prepare(`
        INSERT INTO epg_programs (channel_id, title, start, stop, description)
        VALUES (?, ?, ?, ?, ?)
      `);

      const replaceEpgTransaction = db.transaction((programs) => {
        db.prepare('DELETE FROM epg_programs').run();
        for (const prog of programs) {
          const chId = prog.channel_id || '';
          const title = prog.title || 'Sin Título';
          const start = prog.start || new Date().toISOString();
          const stop = prog.stop || new Date().toISOString();
          const description = prog.description || '';
          
          insertEpg.run(chId, title, start, stop, description);
        }
      });

      replaceEpgTransaction(allPrograms);
      logger.info('Actualización de EPG completada con éxito.');
    } catch (dbErr) {
      logger.error(`Error al insertar programas de EPG: ${dbErr.message}`);
    }
  } else {
    logger.warn('No se parsearon programas de EPG para insertar.');
  }
}

const channelService = {
  getIsUpdating: () => isUpdating,

  updateChannels: async () => {
    if (isUpdating) return;
    isUpdating = true;
    const startTime = Date.now();
    logger.info('Starting channel update...');
    
    try {
      const sources = db.prepare('SELECT * FROM m3u_sources WHERE enabled = 1').all();
      let allChannels = [];
      let sourcesUsed = 0;
      const epgUrls = new Set();

      for (const source of sources) {
        try {
          logger.info(`Fetching source: ${source.name}`);
          const response = await axios.get(source.url, { timeout: 30000 });

          // Extract EPG URLs from M3U header
          const epgUrlMatch = response.data.match(/(?:x-tvg-url|url-tvg)="([^"]+)"/i);
          if (epgUrlMatch) {
            const urls = epgUrlMatch[1].split(',');
            for (const url of urls) {
              if (url.trim()) {
                epgUrls.add(url.trim());
              }
            }
          }

          const channels = parseM3U(response.data);
          
          allChannels = allChannels.concat(channels);
          sourcesUsed++;
          
          db.prepare('UPDATE m3u_sources SET last_channels = ?, last_fetch = CURRENT_TIMESTAMP WHERE id = ?')
            .run(channels.length, source.id);
        } catch (err) {
          logger.error(`Error fetching source ${source.name}: ${err.message}`);
        }
      }

      // Deduplicate by URL
      const uniqueChannels = [];
      const urls = new Set();
      for (const ch of allChannels) {
        if (!urls.has(ch.url)) {
          uniqueChannels.push(ch);
          urls.add(ch.url);
        }
      }

      // Transactional insert
      if (uniqueChannels.length === 0) {
        throw new Error('No se encontraron canales en las fuentes. Abortando actualización para proteger los datos existentes.');
      }

      const deleteChannels = db.prepare('DELETE FROM channels WHERE is_manual = 0');
      const insertChannel = db.prepare(`
        INSERT INTO channels (name, url, logo, group_title, tvg_id, country, language)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((channels) => {
        deleteChannels.run();
        const adultKeywords = ['xxx', 'adult', 'porn', 'hentai', 'erotic', 'sex', 'anal', 'cam', 'brazzers', 'bang', 'nude', 'nsfw', '+18', 'hot', 'strip'];
        
        for (const ch of channels) {
          const name = (ch.name || '').toLowerCase();
          const group = (ch.group || '').toLowerCase();
          
          // Auto-detect adult content during sync
          const isAdult = adultKeywords.some(kw => name.includes(kw) || group.includes(kw)) ? 1 : 0;
          
          // Safety: Don't mark "La Sexta" as adult
          const finalIsAdult = (name.includes('sexta')) ? 0 : isAdult;

          let groupTitle = ch.group || '';
          if (groupTitle.toLowerCase() === 'undefined' || groupTitle.trim() === '') {
            groupTitle = 'Otros';
          }

          insertChannel.run(ch.name, ch.url, ch.logo, groupTitle, ch.tvg_id, ch.country, ch.language);
          
          // Update the is_adult flag if detected
          if (finalIsAdult === 1) {
            db.prepare('UPDATE channels SET is_adult = 1 WHERE url = ?').run(ch.url);
          }
        }
      });

      transaction(uniqueChannels);

      const duration = Date.now() - startTime;
      db.prepare(`
        INSERT INTO update_log (status, channels_loaded, sources_used, duration_ms)
        VALUES (?, ?, ?, ?)
      `).run('success', uniqueChannels.length, sourcesUsed, duration);

      logger.info(`Update finished. Loaded ${uniqueChannels.length} channels from ${sourcesUsed} sources.`);
      
      if (epgUrls.size > 0) {
        updateEPG(epgUrls).catch(err => {
          logger.error(`Error en la actualización en segundo plano de EPG: ${err.message}`);
        });
      }

      return { success: true, count: uniqueChannels.length };
    } catch (error) {
      logger.error(`Update failed: ${error.message}`);
      db.prepare(`
        INSERT INTO update_log (status, error, duration_ms)
        VALUES (?, ?, ?)
      `).run('error', error.message, Date.now() - startTime);
      throw error;
    } finally {
      isUpdating = false;
    }
  }
};

module.exports = channelService;
