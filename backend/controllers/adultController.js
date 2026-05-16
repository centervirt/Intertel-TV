const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'intertel_secret_key_2026';

const adultController = {
  unlock: (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN requerido' });

    try {
      const storedHash = db.prepare("SELECT value FROM settings WHERE key = 'adult_pin_hash'").get()?.value;
      const timeout = db.prepare("SELECT value FROM settings WHERE key = 'adult_session_timeout'").get()?.value || '30';

      if (!storedHash) {
        return res.status(500).json({ error: 'Configuración de adultos no inicializada' });
      }

      const isValid = bcrypt.compareSync(pin, storedHash);
      if (!isValid) {
        return res.status(401).json({ error: 'PIN incorrecto' });
      }

      // Generar token de acceso temporal para adultos
      const adultToken = jwt.sign(
        { adultUnlocked: true, userId: req.user.id },
        JWT_SECRET,
        { expiresIn: `${timeout}m` }
      );

      res.json({ 
        success: true, 
        adultToken, 
        expiresIn: parseInt(timeout) 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = adultController;
