require('dotenv').config();

function int(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

const config = {
  port: int(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  auth: {
    provider: process.env.AUTH_PROVIDER || 'local',
    jwtSecret: process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cognito: {
      region: process.env.AWS_REGION,
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
      clientSecret: process.env.COGNITO_CLIENT_SECRET,
    },
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
    maxUploadMb: int(process.env.MAX_UPLOAD_MB, 8),
    s3: {
      bucket: process.env.S3_BUCKET_NAME,
      region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
      presignExpiry: int(process.env.S3_PRESIGNED_URL_EXPIRY_SECONDS, 300),
    },
  },

  db: {
    provider: process.env.DB_PROVIDER || 'sqlite',
    sqliteFile: process.env.SQLITE_FILE || './data/lostfound.db',
    dynamo: {
      region: process.env.DYNAMO_REGION || 'us-east-1',
      tablePrefix: process.env.DYNAMO_TABLE_PREFIX || 'LostFound_',
    },
  },

  notifications: {
    provider: process.env.NOTIFICATION_PROVIDER || 'inapp',
    sesFromEmail: process.env.SES_FROM_EMAIL,
    snsTopicArn: process.env.SNS_TOPIC_ARN,
  },

  matching: {
    weights: {
      category: int(process.env.MATCH_WEIGHT_CATEGORY, 15),
      brand: int(process.env.MATCH_WEIGHT_BRAND, 15),
      model: int(process.env.MATCH_WEIGHT_MODEL, 15),
      color: int(process.env.MATCH_WEIGHT_COLOR, 10),
      location: int(process.env.MATCH_WEIGHT_LOCATION, 15),
      datetime: int(process.env.MATCH_WEIGHT_DATETIME, 10),
      description: int(process.env.MATCH_WEIGHT_DESCRIPTION, 10),
      serial: int(process.env.MATCH_WEIGHT_SERIAL, 10),
    },
    thresholds: {
      high: int(process.env.MATCH_THRESHOLD_HIGH, 80),
      medium: int(process.env.MATCH_THRESHOLD_MEDIUM, 60),
      low: int(process.env.MATCH_THRESHOLD_LOW, 40),
    },
  },
};

module.exports = config;
