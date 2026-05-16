const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'intertel_secret_key_2026';

const userController = {
  login: (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign(
        { id: user.id, username: user.username, is_admin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token, username: user.username, isAdmin: user.is_admin === 1 });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  },

  getUsers: (req, res) => {
    const users = db.prepare('SELECT id, username, is_admin, created_at FROM users').all();
    res.json(users);
  },

  createUser: (req, res) => {
    const { username, password, is_admin } = req.body;
    try {
      const hashed = bcrypt.hashSync(password, 10);
      db.prepare('INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)').run(username, hashed, is_admin ? 1 : 0);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: 'Username already exists' });
    }
  },

  updateUser: (req, res) => {
    const { password, is_admin } = req.body;
    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password = ?, is_admin = ? WHERE id = ?').run(hashed, is_admin ? 1 : 0, req.params.id);
    } else {
      db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, req.params.id);
    }
    res.json({ success: true });
  },

  deleteUser: (req, res) => {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  }
};

module.exports = userController;
