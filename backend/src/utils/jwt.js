const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.auth.jwtSecret);
}

module.exports = { signToken, verifyToken };
