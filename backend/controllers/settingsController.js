const db = require('../database');

const bcrypt = require('bcryptjs');

const settingsController = {
  getSettings: (req, res) => {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE '%pin_hash%'").all();
    const settings = {};
    rows.forEach(row => settings[row.key] = row.value);
    res.json(settings);
  },

  getAdultSettings: (req, res) => {
    const enabled = db.prepare("SELECT value FROM settings WHERE key = 'adult_enabled'").get()?.value;
    const timeout = db.prepare("SELECT value FROM settings WHERE key = 'adult_session_timeout'").get()?.value;
    res.json({ enabled: enabled === '1', timeout: parseInt(timeout || '30') });
  },

  updateAdultSettings: (req, res) => {
    const { enabled, timeout, pin } = req.body;
    const updates = [
      ['adult_enabled', enabled ? '1' : '0'],
      ['adult_session_timeout', (timeout || '30').toString()]
    ];

    if (pin) {
      const salt = bcrypt.genSaltSync(10);
      updates.push(['adult_pin_hash', bcrypt.hashSync(pin, salt)]);
    }

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const transaction = db.transaction((data) => {
      for (const [key, value] of data) {
        stmt.run(key, value);
      }
    });

    try {
      transaction(updates);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  updateSettings: (req, res) => {
    const settings = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, value.toString());
      }
    });

    try {
      transaction(settings);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = settingsController;
