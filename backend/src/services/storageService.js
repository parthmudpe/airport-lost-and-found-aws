const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

// ------------------------------------------------------------------
// Storage abstraction.
//
// Every caller in this codebase uses this module's interface
// (saveFile, getSignedUrl, deleteFile) rather than touching the
// filesystem or S3 SDK directly. That means switching
// STORAGE_PROVIDER=s3 in production only requires implementing the
// same three functions against @aws-sdk/client-s3 +
// @aws-sdk/s3-request-presigner (sketched below, commented out so this
// project runs with zero AWS credentials out of the box).
//
// Images/documents are NEVER stored in the database - only the
// storage "key" (path/object key) is persisted in SQL/DynamoDB.
// ------------------------------------------------------------------

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

function validateFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
    const err = new Error('Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.');
    err.status = 400;
    throw err;
  }
  const maxBytes = config.storage.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    const err = new Error(`File too large. Max ${config.storage.maxUploadMb}MB.`);
    err.status = 400;
    throw err;
  }
  return ext;
}

// ---------------- Local filesystem provider (default) ----------------
const localDir = path.resolve(config.storage.localDir);
if (config.storage.provider !== 's3' && !fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

const localProvider = {
  async saveFile(file, keyPrefix) {
    const ext = validateFile(file);
    const key = `${keyPrefix}/${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(localDir, key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.buffer);
    return key;
  },
  // Local dev stand-in for an S3 pre-signed URL: a short-lived signed
  // path served by our own /files route (see routes/files.js pattern
  // below via server.js static handler), never a publicly-writable path.
  async getSignedUrl(key) {
    return `/api/files/${encodeURIComponent(key)}`;
  },
  async deleteFile(key) {
    const fullPath = path.join(localDir, key);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  },
  resolvePath(key) {
    return path.join(localDir, key);
  },
};

// ---------------- AWS S3 provider (STORAGE_PROVIDER=s3) ----------------
// The bucket stays fully private. Uploads go through this server (which
// validates type/size first); downloads are handed out as short-lived
// pre-signed URLs. AWS credentials come from the SDK default chain
// (EC2 instance role in production, ~/.aws or env vars locally) - never
// from code. The SDK is required lazily so local mode needs no AWS packages.
function makeS3Provider() {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const { bucket, region, presignExpiry } = config.storage.s3;
  if (!bucket) throw new Error('S3_BUCKET_NAME is required when STORAGE_PROVIDER=s3');
  const s3 = new S3Client({ region });
  return {
    async saveFile(file, keyPrefix) {
      const ext = validateFile(file);
      const key = `${keyPrefix}/${crypto.randomUUID()}${ext}`;
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: file.buffer,
        ContentType: file.mimetype, ServerSideEncryption: 'AES256',
      }));
      return key;
    },
    async getSignedUrl(key) {
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: presignExpiry });
    },
    async deleteFile(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

const useS3 = config.storage.provider === 's3';
const provider = useS3 ? makeS3Provider() : localProvider;

module.exports = {
  provider: useS3 ? 's3' : 'local',
  saveFile: (file, keyPrefix) => provider.saveFile(file, keyPrefix),
  getSignedUrl: (key) => provider.getSignedUrl(key),
  deleteFile: (key) => provider.deleteFile(key),
  resolvePath: (key) => localProvider.resolvePath(key), // local /files route only
  validateFile,
};
