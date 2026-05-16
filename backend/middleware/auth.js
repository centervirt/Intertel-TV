const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'intertel_secret_key_2026';

const auth = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, is_admin: decoded.is_admin };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token format' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.is_admin !== 1) return res.status(403).json({ error: 'Admin access required' });
  next();
};

const authAdult = (req, res, next) => {
  const token = req.header('x-adult-token');
  req.sessionAdultUnlocked = false;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.adultUnlocked && decoded.userId === req.user.id) {
        req.sessionAdultUnlocked = true;
      }
    } catch (err) {
      // Token expired or invalid — just continue without adult access
    }
  }
  next();
};

const authProfile = (req, res, next) => {
  const token = req.header('x-profile-token');
  if (!token) return res.status(401).json({ error: 'No profile selected' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.profile = {
      id: decoded.profileId,
      accessLevel: decoded.accessLevel,
      type: decoded.type
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid profile session' });
  }
};

module.exports = { auth, adminOnly, authAdult, authProfile };
