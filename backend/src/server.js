const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const authRoutes = require('./routes/auth');
const lostItemRoutes = require('./routes/lostItems');
const foundItemRoutes = require('./routes/foundItems');
const matchRoutes = require('./routes/matches');
const ownershipRoutes = require('./routes/ownershipVerification');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const auditLogRoutes = require('./routes/auditLogs');
const adminRoutes = require('./routes/admin');
const airportRoutes = require('./routes/airports');
const fileRoutes = require('./routes/files');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
if (config.nodeEnv === 'production') app.set('trust proxy', 1); // behind Caddy/reverse proxy
app.use(cors({ origin: config.clientUrl.split(',').map((o) => o.trim()), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// Basic API rate limiting (per project security requirements).
// Auth endpoints get a tighter limit to slow down credential stuffing.
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', env: config.nodeEnv, dbProvider: config.db.provider, storageProvider: config.storage.provider }));

app.use('/api/auth', authRoutes);
app.use('/api/lost-items', lostItemRoutes);
app.use('/api/found-items', foundItemRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/ownership-verification', ownershipRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/airports', airportRoutes);
app.use('/api/files', fileRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[server] Airport Lost & Found API listening on port ${config.port} (${config.nodeEnv})`);
    console.log(`[server] DB provider: ${config.db.provider} | Storage provider: ${config.storage.provider} | Auth provider: ${config.auth.provider}`);
  });
}

module.exports = app;
