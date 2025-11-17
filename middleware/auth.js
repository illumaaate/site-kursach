const jwt = require('jsonwebtoken');

function extractToken(headerValue = '') {
  if (headerValue.startsWith('Bearer ')) {
    return headerValue.slice(7);
  }
  return null;
}

module.exports = function authMiddleware(req, res, next) {
  const rawHeader = req.headers.authorization || '';
  const token = extractToken(rawHeader);
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
};

