module.exports = {
  apps: [{
    name: 'intertel-tv-backend',
    script: 'backend/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
