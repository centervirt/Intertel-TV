const axios = require('axios');
const db = require('../database');
const { parseM3U } = require('../parsers/m3uParser');
const logger = require('../utils/logger');

let isUpdating = false;

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

      for (const source of sources) {
        try {
          logger.info(`Fetching source: ${source.name}`);
          const response = await axios.get(source.url, { timeout: 30000 });
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

      const deleteChannels = db.prepare('DELETE FROM channels');
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

          insertChannel.run(ch.name, ch.url, ch.logo, ch.group, ch.tvg_id, ch.country, ch.language);
          
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
