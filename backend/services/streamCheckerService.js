const axios = require('axios');
const db = require('../database');
const logger = require('../utils/logger');
const alertService = require('./alertService');

let isChecking = false;

const streamCheckerService = {
  checkAllStreams: async () => {
    if (isChecking) return;
    isChecking = true;
    logger.info('Starting stream health check (Auto-Recovery Mode)...');
    
    try {
      const channels = db.prepare('SELECT id, url, name, is_enabled, fail_count, success_count, status FROM channels').all();
      let offlineCount = 0;

      for (const channel of channels) {
        let isOnline = false;
        let failReason = '';
        const isYouTube = channel.url.includes('youtube.com') || channel.url.includes('youtu.be');

        try {
          // 1. Intentar petición GET parcial (primer KB) para validar formato y CORS
          const response = await axios.get(channel.url, { 
            timeout: 5000, 
            headers: { 
              'Range': 'bytes=0-1023',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            responseType: 'text'
          });

          if (isYouTube) {
            // Para YouTube, la respuesta HTTP 200 es suficiente (se carga mediante iframe)
            isOnline = true;
          } else {
            const content = (response.data || '').toString();
            const contentType = (response.headers['content-type'] || '').toLowerCase();
            
            const isM3U8 = content.includes('#EXTM3U') || content.includes('#EXT-X-STREAM-INF') || contentType.includes('mpegurl') || contentType.includes('x-mpegurl');
            const isBinaryVideo = contentType.includes('video/') || contentType.includes('audio/') || contentType.includes('application/octet-stream');
            
            if (!isM3U8 && !isBinaryVideo) {
              isOnline = false;
              failReason = 'Formato de transmisión no válido (posible redirección a página de error)';
            } else {
              // Validar cabeceras CORS
              const corsHeader = response.headers['access-control-allow-origin'];
              const hasCors = corsHeader === '*' || corsHeader === 'null' || (corsHeader && corsHeader.includes('http'));
              
              if (!hasCors) {
                isOnline = false;
                failReason = 'Bloqueo por CORS (sin cabecera Access-Control-Allow-Origin)';
              } else {
                isOnline = true;
              }
            }
          }
        } catch (err) {
          // 2. Si falló la petición parcial (algunos servidores bloquean Range), intentar HEAD estándar
          try {
            const headResponse = await axios.head(channel.url, { 
              timeout: 5000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });

            if (isYouTube) {
              isOnline = true;
            } else {
              const corsHeader = headResponse.headers['access-control-allow-origin'];
              const hasCors = corsHeader === '*' || corsHeader === 'null' || (corsHeader && corsHeader.includes('http'));
              
              if (!hasCors) {
                isOnline = false;
                failReason = 'Bloqueo por CORS (verificado por HEAD)';
              } else {
                isOnline = true;
              }
            }
          } catch (headErr) {
            isOnline = false;
            failReason = `Servidor de origen inaccesible (${headErr.message})`;
          }
        }

        if (isOnline) {
          const newSuccessCount = (channel.success_count || 0) + 1;
          
          if (newSuccessCount >= 3 && channel.status !== 'active') {
            // AUTO-RECOVERY
            db.prepare("UPDATE channels SET is_online = 1, is_enabled = 1, fail_count = 0, success_count = ?, status = 'active' WHERE id = ?")
              .run(newSuccessCount, channel.id);
            alertService.createAlert(`Canal recuperado automáticamente: ${channel.name}`, 'info');
            logger.info(`Auto-Recovery: ${channel.name} is back online.`);
          } else {
            db.prepare('UPDATE channels SET is_online = 1, fail_count = 0, success_count = ? WHERE id = ?')
              .run(newSuccessCount, channel.id);
          }
        } else {
          const newFailCount = (channel.fail_count || 0) + 1;
          let newStatus = channel.status;
          let newIsEnabled = channel.is_enabled;
          offlineCount++;

          if (newFailCount >= 5) {
            newStatus = 'maintenance';
            newIsEnabled = 0;
            if (channel.status !== 'maintenance') {
              alertService.createAlert(`Canal en mantenimiento (5 fallos): ${channel.name}`, 'error');
            }
          } else if (newFailCount >= 3) {
            newStatus = 'unstable';
            if (channel.status !== 'unstable') {
              alertService.createAlert(`Canal inestable (3 fallos): ${channel.name}`, 'warning');
            }
          } else {
            newStatus = 'warning';
          }

          db.prepare('UPDATE channels SET is_online = 0, fail_count = ?, success_count = 0, status = ?, is_enabled = ? WHERE id = ?')
            .run(newFailCount, newStatus, newIsEnabled, channel.id);
          
          logger.warn(`Stream check failed: ${channel.name} (Fail #${newFailCount}, Status: ${newStatus}). Razón: ${failReason}`);
        }
      }

      logger.info(`Health check finished. ${offlineCount} streams currently problematic.`);
    } catch (error) {
      logger.error(`Health check failed: ${error.message}`);
    } finally {
      isChecking = false;
    }
  }
};

module.exports = streamCheckerService;
