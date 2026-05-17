const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
const bcrypt = require('bcryptjs');

const db = require('./database');
const apiRoutes = require('./routes/api');
const { generalLimiter } = require('./middleware/rateLimit');
const channelService = require('./services/channelService');
const streamCheckerService = require('./services/streamCheckerService');
const analyticsService = require('./services/analyticsService');
const logger = require('./utils/logger');

const app = express();
const port = process.env.PORT || 3001;

// Initial Seeding
const seedAdmin = db.prepare('INSERT OR IGNORE INTO users (username, password, is_admin) VALUES (?, ?, ?)');
const hashedAdmin = bcrypt.hashSync('intertel2024', 10);
seedAdmin.run('admin', hashedAdmin, 1);

const sourceCount = db.prepare('SELECT COUNT(*) as count FROM m3u_sources').get().count;
if (sourceCount === 0) {
  const seedSources = db.prepare('INSERT OR IGNORE INTO m3u_sources (name, url) VALUES (?, ?)');
  seedSources.run('Argentina (iptv-org)', 'https://iptv-org.github.io/iptv/countries/ar.m3u');
  seedSources.run('Español (iptv-org)', 'https://iptv-org.github.io/iptv/languages/spa.m3u');
}

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/', generalLimiter);

// Routes
app.use('/api', apiRoutes);

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Serve downloadable files (like APKs)
app.use('/api/downloads', express.static(path.join(__dirname, 'downloads')));

// Cron job: 3am every day
cron.schedule('0 3 * * *', () => {
  channelService.updateChannels();
});

// Cron job: Check streams every 6 hours
cron.schedule('0 */6 * * *', () => {
  streamCheckerService.checkAllStreams();
});

// Cron job: Cleanup inactive sessions every 2 minutes
cron.schedule('*/2 * * * *', () => {
  analyticsService.cleanupSessions();
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  channelService.updateChannels(); // Run on startup
});
