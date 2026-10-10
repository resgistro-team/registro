const jwt = require('jsonwebtoken');
const store = require('../data/store');

const JWT_SECRET = process.env.JWT_SECRET || 'registro_super_secret_jwt_key_2026';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = store.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        code: 'USER_NOT_FOUND',
        error: { code: 'USER_NOT_FOUND', message: 'User not found. Please sign in again.' },
        message: 'User not found. Please sign in again.'
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session. Please sign in again.' },
      message: 'Invalid or expired session. Please sign in again.'
    });
  }
}

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = store.getUserById(decoded.id) || null;
  } catch (err) {
    req.user = null;
  }
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authMiddleware,
  optionalAuthMiddleware
};
