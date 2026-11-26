const jwt = require('jsonwebtoken');

function signToken(user, secret) {
  return jwt.sign({ sub: user.id }, secret, { expiresIn: '7d' });
}

function requireAuth(secret) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in.' });
    try {
      req.userId = jwt.verify(token, secret).sub;
      next();
    } catch {
      res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
  };
}

module.exports = { signToken, requireAuth };
