// Tests for the AWS-mode code paths. AWS SDKs are mocked (virtual), so these
// run without credentials, network, or the SDK packages being exercised.
process.env.SQLITE_FILE = ':memory:';
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';
process.env.STORAGE_PROVIDER = 's3';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.AWS_REGION = 'us-east-1';
process.env.AUTH_PROVIDER = 'cognito';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST';
process.env.COGNITO_CLIENT_ID = 'testclient';

const sent = [];
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send(cmd) { sent.push(cmd); return Promise.resolve({}); } },
  PutObjectCommand: class { constructor(i) { this.type = 'put'; this.input = i; } },
  GetObjectCommand: class { constructor(i) { this.type = 'get'; this.input = i; } },
  DeleteObjectCommand: class { constructor(i) { this.type = 'delete'; this.input = i; } },
}), { virtual: true });
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async (c, cmd, opts) => `https://signed.example/${cmd.input.Key}?exp=${opts.expiresIn}`),
}), { virtual: true });
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: () => ({
    verify: async (t) => {
      const map = {
        'tok-pass': { sub: 'u-pass', email: 'p@x.com', name: 'P', 'cognito:groups': ['PASSENGER'] },
        'tok-staff': { sub: 'u-staff', email: 's@x.com', name: 'S', 'cognito:groups': ['STAFF'] },
        'tok-nogroup': { sub: 'u-none', email: 'n@x.com', name: 'N' },
      };
      if (!map[t]) throw new Error('bad token');
      return map[t];
    } }) },
}), { virtual: true });

const request = require('supertest');
const app = require('../src/server');
const storage = require('../src/services/storageService');
const { roleFromGroups } = require('../src/services/cognitoService');

describe('S3 storage provider', () => {
  test('uploads privately with encryption and an opaque key', async () => {
    const key = await storage.saveFile({ mimetype: 'image/png', originalname: 'a.png', size: 10, buffer: Buffer.alloc(10) }, 'lost-items/u1');
    const put = sent.find((c) => c.type === 'put');
    expect(key).toMatch(/^lost-items\/u1\/[0-9a-f-]+\.png$/);
    expect(put.input.Bucket).toBe('test-bucket');
    expect(put.input.ServerSideEncryption).toBe('AES256');
    expect(put.input.ACL).toBeUndefined(); // never public
  });
  test('download URL is a short-lived pre-signed URL', async () => {
    expect(await storage.getSignedUrl('lost-items/u1/x.png')).toContain('exp=300');
  });
  test('delete sends DeleteObject', async () => {
    await storage.deleteFile('lost-items/u1/x.png');
    expect(sent.some((c) => c.type === 'delete')).toBe(true);
  });
  test('invalid file types are still rejected', async () => {
    await expect(storage.saveFile({ mimetype: 'text/html', originalname: 'a.html', size: 5, buffer: Buffer.alloc(5) }, 'x')).rejects.toThrow();
  });
});

describe('files route access control (S3 mode)', () => {
  test('passenger gets a redirect to a signed URL for own file', async () => {
    const res = await request(app).get('/api/files/lost-items/u-pass/a.png').set('Authorization', 'Bearer tok-pass');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://signed.example/');
  });
  test("passenger cannot open another user's file", async () => {
    const res = await request(app).get('/api/files/lost-items/someone-else/a.png').set('Authorization', 'Bearer tok-pass');
    expect(res.status).toBe(403);
  });
  test('staff can open any file', async () => {
    const res = await request(app).get('/api/files/lost-items/someone-else/a.png').set('Authorization', 'Bearer tok-staff');
    expect(res.status).toBe(302);
  });
});

describe('Cognito authentication', () => {
  test('roleFromGroups maps groups with ADMIN > STAFF > PASSENGER and defaults to PASSENGER', () => {
    expect(roleFromGroups(['PASSENGER', 'ADMIN'])).toBe('ADMIN');
    expect(roleFromGroups(['STAFF'])).toBe('STAFF');
    expect(roleFromGroups(undefined)).toBe('PASSENGER');
    expect(roleFromGroups(['SOMETHING_ELSE'])).toBe('PASSENGER');
  });
  test('missing or invalid tokens are rejected', async () => {
    expect((await request(app).get('/api/dashboard/staff')).status).toBe(401);
    expect((await request(app).get('/api/dashboard/staff').set('Authorization', 'Bearer nope')).status).toBe(401);
  });
  test('role comes from the Cognito group: passenger blocked, staff allowed', async () => {
    expect((await request(app).get('/api/dashboard/staff').set('Authorization', 'Bearer tok-pass')).status).toBe(403);
    expect((await request(app).get('/api/dashboard/staff').set('Authorization', 'Bearer tok-staff')).status).toBe(200);
  });
  test('a user with no group is treated as a passenger (least privilege)', async () => {
    expect((await request(app).get('/api/dashboard/staff').set('Authorization', 'Bearer tok-nogroup')).status).toBe(403);
  });
  test('a role header or body sent by the client cannot escalate privileges', async () => {
    const res = await request(app).get('/api/dashboard/staff').set('Authorization', 'Bearer tok-pass').set('X-Role', 'ADMIN');
    expect(res.status).toBe(403);
  });
});
