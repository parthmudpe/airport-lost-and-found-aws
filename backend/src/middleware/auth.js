const config = require('../config');
const { verifyToken } = require('../utils/jwt');
const { Users } = require('../db/repository');

const isCognito = config.auth.provider === 'cognito';

// Maps a verified Cognito ID-token payload to a local user row.
// Cognito remains the source of truth for identity and role.
function resolveCognitoUser(payload, options = {}) {
  const cognito = require('../services/cognitoService');
  const role = cognito.roleFromGroups(payload['cognito:groups']);

  let user = Users.getById(payload.sub);

  if (!user) {
    if (Users.getByEmail(payload.email)) {
      throw Object.assign(
        new Error('Email already linked to a different account'),
        { status: 409 }
      );
    }

    user = Users.create({
      id: payload.sub,
      email: payload.email,
      passwordHash: 'COGNITO_MANAGED',
      fullName: payload.name || payload.email,
      phone: options.phone || payload.phone_number || null,
      role,
    });
  } else if (user.role !== role) {
    user = Users.setRole(user.id, role);
  }

  return user;
}

// Verifies a freshly issued Cognito token and resolves its local user.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Missing or invalid Authorization header',
    });
  }

  try {
    let user;

    if (isCognito) {
      const payload = await require('../services/cognitoService')
        .verifyIdToken(token);

      user = resolveCognitoUser(payload);
    } else {
      user = Users.getById(verifyToken(token).sub);
    }

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'User not found or deactivated',
      });
    }

    req.user = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name,
    };

    req.dbUser = user;
    next();
  } catch (err) {
    if (err.status) return next(err);

    return res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
}

module.exports = {
  requireAuth,
  resolveCognitoUser,
};