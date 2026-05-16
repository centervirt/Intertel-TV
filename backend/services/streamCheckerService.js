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
        try {
          await axios.head(channel.url, { timeout: 5000 });
          isOnline = true;
        } catch (err) {
          try {
            await axios.get(channel.url, { timeout: 5000, headers: { Range: 'bytes=0-1' } });
            isOnline = true;
          } catch (err2) {
            isOnline = false;
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
          
          logger.warn(`Stream check failed: ${channel.name} (Fail #${newFailCount}, Status: ${newStatus})`);
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
