const config = require('../config');
const { verifyToken } = require('../utils/jwt');
const { Users } = require('../db/repository');

const isCognito = config.auth.provider === 'cognito';

// Maps a verified Cognito ID-token payload to a local user row (created
// on first sight, role re-synced from Cognito groups every request so a
// group change takes effect immediately). The local row holds app data
// such as airport assignment; Cognito remains the source of truth for
// identity and role.
function resolveCognitoUser(payload) {
  const cognito = require('../services/cognitoService');
  const role = cognito.roleFromGroups(payload['cognito:groups']);
  let user = Users.getById(payload.sub);
  if (!user) {
    if (Users.getByEmail(payload.email)) {
      throw Object.assign(new Error('Email already linked to a different account'), { status: 409 });
    }
    user = Users.create({
      id: payload.sub, email: payload.email, passwordHash: 'COGNITO_MANAGED',
      fullName: payload.name || payload.email, role,
    });
  } else if (user.role !== role) {
    user = Users.setRole(user.id, role);
  }
  return user;
}

// Attaches req.user = { sub, email, role, name } and req.dbUser.
// Role always comes from the verified token (Cognito groups) or the
// signed local JWT - never from the request body or headers.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    let user;
    if (isCognito) {
      const payload = await require('../services/cognitoService').verifyIdToken(token);
      user = resolveCognitoUser(payload);
    } else {
      user = Users.getById(verifyToken(token).sub);
    }
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }
    req.user = { sub: user.id, email: user.email, role: user.role, name: user.full_name };
    req.dbUser = user;
    next();
  } catch (e) {
    if (e.status) return next(e);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth, resolveCognitoUser };
