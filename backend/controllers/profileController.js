const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auditService = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'intertel_secret_key_2026';

const profileController = {
  getProfiles: (req, res) => {
    try {
      const profiles = db.prepare(`
        SELECT id, name, type, avatar, access_level,
        CASE WHEN pin_hash IS NOT NULL AND pin_hash != '' THEN 1 ELSE 0 END as has_pin
        FROM profiles WHERE user_id = ?
      `).all(req.user.id);
      
      // If no profiles, create default "Home" profile
      if (profiles.length === 0) {
        db.prepare('INSERT INTO profiles (user_id, name, type, access_level) VALUES (?, ?, ?, ?)').run(req.user.id, 'Principal', 'home', 3);
        const newProfiles = db.prepare(`
          SELECT id, name, type, avatar, access_level,
          CASE WHEN pin_hash IS NOT NULL AND pin_hash != '' THEN 1 ELSE 0 END as has_pin
          FROM profiles WHERE user_id = ?
        `).all(req.user.id);
        return res.json(newProfiles);
      }
      
      res.json(profiles);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createProfile: (req, res) => {
    const { name, type, pin, access_level } = req.body;
    try {
      const pinHash = pin ? bcrypt.hashSync(pin, 10) : null;
      const result = db.prepare('INSERT INTO profiles (user_id, name, type, pin_hash, access_level) VALUES (?, ?, ?, ?, ?)').run(
        req.user.id, name, type, pinHash, access_level || 1
      );
      res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  selectProfile: (req, res) => {
    const { profileId, pin } = req.body;
    try {
      const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(profileId, req.user.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      if (profile.pin_hash) {
        if (!pin || !bcrypt.compareSync(pin, profile.pin_hash)) {
          auditService.logEvent(req.user.id, profileId, 'profile_unlock_failed', req);
          return res.status(401).json({ error: 'PIN incorrecto' });
        }
      }

      // Generate profile-specific token
      const profileToken = jwt.sign({
        userId: req.user.id,
        profileId: profile.id,
        accessLevel: profile.access_level,
        type: profile.type
      }, JWT_SECRET, { expiresIn: '12h' });

      auditService.logEvent(req.user.id, profileId, 'profile_selected', req);
      
      res.json({ 
        success: true, 
        profileToken, 
        profile: { id: profile.id, name: profile.name, accessLevel: profile.access_level } 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getAuditLogs: (req, res) => {
    // Admin only
    if (req.user.is_admin !== 1) return res.status(403).json({ error: 'Forbidden' });
    res.json(auditService.getLogs());
  }
};

module.exports = profileController;
