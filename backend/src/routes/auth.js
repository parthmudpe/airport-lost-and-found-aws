const express = require('express');
const { z } = require('zod');
const { Users, Airports } = require('../db/repository');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const validate = require('../middleware/validate');
const { requireAuth, resolveCognitoUser } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { audit } = require('../services/auditService');
const config = require('../config');

const isCognito = config.auth.provider === 'cognito';
const cognito = () => require('../services/cognitoService');

// Verify a Cognito ID token and create/find the associated local user.
// The optional phone value is saved in the local user record.
async function userFromIdToken(idToken, options = {}) {
  const payload = await cognito().verifyIdToken(idToken);
  return resolveCognitoUser(payload, options);
}

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

// Public self-registration only creates PASSENGER accounts.
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, phone } = req.body;
    const cleanedPhone = phone?.trim() || null;

    if (isCognito) {
      try {
        await cognito().signUpPassenger({
          email,
          password,
          fullName,
        });

        const idToken = await cognito().signIn(email, password);

        // Important: pass the submitted phone number when resolving
        // the new Cognito identity into the local application database.
        const user = await userFromIdToken(idToken, {
          phone: cleanedPhone,
        });

        audit(
          { user: { sub: user.id, role: user.role } },
          {
            action: 'REGISTER',
            entityType: 'USER',
            entityId: user.id,
          }
        );

        return res.status(201).json({
          token: idToken,
          user: publicUser(user),
        });
      } catch (err) {
        throw cognito().toHttpError(err);
      }
    }

    if (Users.getByEmail(email)) {
      const err = new Error('An account with this email already exists');
      err.status = 409;
      throw err;
    }

    const passwordHash = await hashPassword(password);

    const user = Users.create({
      email,
      passwordHash,
      fullName,
      phone: cleanedPhone,
      role: 'PASSENGER',
    });

    audit(req, {
      action: 'REGISTER',
      entityType: 'USER',
      entityId: user.id,
    });

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (isCognito) {
      try {
        const idToken = await cognito().signIn(email, password);
        const user = await userFromIdToken(idToken);

        if (!user.is_active) {
          throw Object.assign(
            new Error('Invalid email or password'),
            { status: 401 }
          );
        }

        audit(
          { user: { sub: user.id, role: user.role } },
          {
            action: 'LOGIN',
            entityType: 'USER',
            entityId: user.id,
          }
        );

        return res.json({
          token: idToken,
          user: publicUser(user),
        });
      } catch (err) {
        throw cognito().toHttpError(err);
      }
    }

    const user = Users.getByEmail(email);

    if (!user || !user.is_active) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const ok = await verifyPassword(password, user.password_hash);

    if (!ok) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    req.user = {
      sub: user.id,
      role: user.role,
    };

    audit(req, {
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
    });

    const token = signToken(user);

    return res.json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: publicUser(req.dbUser),
  });
});

// Admin-only creation of STAFF or ADMIN accounts.
const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(['STAFF', 'ADMIN']),
  airportId: z.string().optional(),
});

router.post(
  '/admin/create-user',
  requireAuth,
  requireRole('ADMIN'),
  validate(createStaffSchema),
  async (req, res, next) => {
    try {
      const {
        email,
        password,
        fullName,
        phone,
        role,
        airportId,
      } = req.body;

      if (Users.getByEmail(email)) {
        const err = new Error('An account with this email already exists');
        err.status = 409;
        throw err;
      }

      if (airportId && !Airports.getById(airportId)) {
        const err = new Error('Unknown airportId');
        err.status = 400;
        throw err;
      }

      let user;

      if (isCognito) {
        try {
          const sub = await cognito().adminCreateUser({
            email,
            password,
            fullName,
            role,
          });

          user = Users.create({
            id: sub,
            email,
            passwordHash: 'COGNITO_MANAGED',
            fullName,
            phone: phone?.trim() || null,
            role,
            airportId,
          });
        } catch (err) {
          throw cognito().toHttpError(err);
        }
      } else {
        user = Users.create({
          email,
          passwordHash: await hashPassword(password),
          fullName,
          phone: phone?.trim() || null,
          role,
          airportId,
        });
      }

      audit(req, {
        action: 'ADMIN_CREATE_USER',
        entityType: 'USER',
        entityId: user.id,
        metadata: { role },
      });

      return res.status(201).json({
        user: publicUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    role: user.role,
    airportId: user.airport_id,
    isActive: !!user.is_active,
    createdAt: user.created_at,
  };
}

module.exports = router;