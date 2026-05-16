const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window per IP
  message: { error: 'Too many requests, please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 min (enough for normal use)
  message: { error: 'Demasiados intentos de acceso. Intenta en 15 minutos.' },
  skipSuccessfulRequests: true, // Don't count successful logins
});

const unlockLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 PIN attempts per 10 min
  message: { error: 'PIN incorrecto demasiadas veces. Bloqueado por 10 min.' }
});

module.exports = { generalLimiter, loginLimiter, unlockLimiter };
