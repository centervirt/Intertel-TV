const express = require('express');
const router = express.Router();
const db = require('../database');

const { auth, adminOnly, authAdult, authProfile } = require('../middleware/auth');
const { loginLimiter, unlockLimiter } = require('../middleware/rateLimit');

const userController = require('../controllers/userController');
const channelController = require('../controllers/channelController');
const adminController = require('../controllers/adminController');
const analyticsController = require('../controllers/analyticsController');
const settingsController = require('../controllers/settingsController');
const adultController = require('../controllers/adultController');
const profileController = require('../controllers/profileController');

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

module.exports = router;
