const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const downloadsDir = path.join(__dirname, '../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, downloadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });
const { auth, adminOnly, authAdult, authProfile } = require('../middleware/auth');
const { loginLimiter, unlockLimiter } = require('../middleware/rateLimit');

const userController = require('../controllers/userController');
const channelController = require('../controllers/channelController');
const adminController = require('../controllers/adminController');
const analyticsController = require('../controllers/analyticsController');
const settingsController = require('../controllers/settingsController');
const adultController = require('../controllers/adultController');
const profileController = require('../controllers/profileController');
const vodController = require('../controllers/vodController');

// Public
router.post('/login', loginLimiter, userController.login);
router.get('/settings', settingsController.getSettings);

// Profiles
router.get('/profiles', auth, profileController.getProfiles);
router.post('/profiles', auth, profileController.createProfile);
router.post('/profiles/select', auth, profileController.selectProfile);

// Content (Requires active profile session)
router.post('/track', auth, authProfile, analyticsController.track);
router.get('/channels', auth, authProfile, authAdult, channelController.getChannels);
router.get('/channels/groups', auth, authProfile, authAdult, channelController.getGroups);
router.get('/channels/stats', auth, authProfile, channelController.getStats);
router.get('/epg/:channelId', auth, authProfile, channelController.getEPG);
router.get('/favorites', auth, authProfile, channelController.getFavorites);
router.post('/favorites/:channelId', auth, authProfile, channelController.addFavorite);
router.delete('/favorites/:channelId', auth, authProfile, channelController.removeFavorite);

// VoD (Video on Demand) Routes
router.get('/vod/home', auth, authProfile, vodController.getHome);
router.get('/vod/search', auth, authProfile, vodController.search);
router.get('/vod/info/:type/:id', auth, authProfile, vodController.getInfo);
router.get('/vod/info/tv/:tvId/season/:seasonNumber', auth, authProfile, vodController.getSeasonEpisodes);
router.get('/vod/stream/:type/:id', auth, authProfile, vodController.getStream);

// Adult Unlock
router.post('/adult/unlock', auth, adultController.unlock);

// Admin - Dashboard & Stats
router.get('/admin/dashboard', auth, adminOnly, adminController.getDashboardData);
router.get('/admin/stats', auth, adminOnly, adminController.getStats);
router.post('/admin/refresh', auth, adminOnly, adminController.refreshChannels);

// Admin - Users
router.get('/admin/users', auth, adminOnly, userController.getUsers);
router.post('/admin/users', auth, adminOnly, userController.createUser);
router.put('/admin/users/:id', auth, adminOnly, userController.updateUser);
router.delete('/admin/users/:id', auth, adminOnly, userController.deleteUser);

// Admin - Sources
router.get('/admin/sources', auth, adminOnly, adminController.getSources);
router.post('/admin/sources', auth, adminOnly, adminController.createSource);
router.put('/admin/sources/:id', auth, adminOnly, adminController.updateSource);
router.delete('/admin/sources/:id', auth, adminOnly, adminController.deleteSource);

// Admin - Settings & Branding
router.put('/admin/settings', auth, adminOnly, settingsController.updateSettings);
router.get('/admin/settings/adult', auth, adminOnly, settingsController.getAdultSettings);
router.put('/admin/settings/adult', auth, adminOnly, settingsController.updateAdultSettings);
router.get('/admin/audit', auth, adminOnly, profileController.getAuditLogs);

// Admin - APK Uploads
router.get('/admin/apks', auth, adminOnly, (req, res) => {
  try {
    const files = fs.readdirSync(downloadsDir);
    const apks = files.map(file => {
      const stats = fs.statSync(path.join(downloadsDir, file));
      return {
        name: file,
        size: stats.size,
        created_at: stats.mtime
      };
    });
    res.json(apks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/apks', auth, adminOnly, upload.single('apk'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, filename: req.file.filename });
});

router.delete('/admin/apks/:filename', auth, adminOnly, (req, res) => {
  try {
    const filePath = path.join(downloadsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Admin - Channels management (no profile token needed)
router.get('/admin/channels', auth, adminOnly, (req, res) => {
  const { search = '', group = '', adult_only = '' } = req.query;
  let query = 'SELECT id, name, group_title, is_adult, is_enabled, status FROM channels WHERE 1=1';
  const params = [];
  if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }
  if (group) { query += ' AND group_title = ?'; params.push(group); }
  if (adult_only === '1') { query += ' AND is_adult = 1'; }
  query += ' ORDER BY is_adult DESC, name LIMIT 200';
  try {
    const channels = db.prepare(query).all(...params);
    const groups = db.prepare('SELECT DISTINCT group_title FROM channels ORDER BY group_title').all();
    res.json({ channels, groups: groups.map(g => g.group_title) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/channels/:id', auth, adminOnly, (req, res) => {
  const { is_adult } = req.body;
  try {
    db.prepare('UPDATE channels SET is_adult = ? WHERE id = ?').run(is_adult, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin - Mark entire group as adult
router.post('/admin/channels/mark-group', auth, adminOnly, (req, res) => {
  const { group_title, is_adult } = req.body;
  try {
    const result = db.prepare('UPDATE channels SET is_adult = ? WHERE group_title = ?').run(is_adult ? 1 : 0, group_title);
    res.json({ success: true, updated: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin - YouTube Manual Channels management
router.get('/admin/youtube', auth, adminOnly, (req, res) => {
  try {
    const channels = db.prepare("SELECT * FROM channels WHERE is_manual = 1 ORDER BY id DESC").all();
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/youtube', auth, adminOnly, (req, res) => {
  const { name, url, logo = '', group_title, is_adult = 0 } = req.body;
  if (!name || !url || !group_title) {
    return res.status(400).json({ error: 'Faltan campos requeridos (nombre, url, categoria).' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO channels (name, url, logo, group_title, is_adult, is_manual, is_online, is_enabled)
      VALUES (?, ?, ?, ?, ?, 1, 1, 1)
    `).run(name, url, logo, group_title, is_adult ? 1 : 0);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/youtube/:id', auth, adminOnly, (req, res) => {
  const { name, url, logo, group_title, is_adult } = req.body;
  try {
    db.prepare(`
      UPDATE channels 
      SET name = ?, url = ?, logo = ?, group_title = ?, is_adult = ? 
      WHERE id = ? AND is_manual = 1
    `).run(name, url, logo, group_title, is_adult ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/youtube/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM channels WHERE id = ? AND is_manual = 1').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
