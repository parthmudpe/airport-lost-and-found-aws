process.env.SQLITE_FILE = ':memory:';
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';
process.env.LOCAL_UPLOAD_DIR = './uploads-test';
process.env.MAX_UPLOAD_MB = '1';

const storageService = require('../src/services/storageService');

function fakeFile({ mimetype, originalname, size = 1000 }) {
  return { mimetype, originalname, size, buffer: Buffer.alloc(size) };
}

describe('storageService.validateFile', () => {
  test('accepts allowed image types', () => {
    expect(() => storageService.validateFile(fakeFile({ mimetype: 'image/jpeg', originalname: 'photo.jpg' }))).not.toThrow();
    expect(() => storageService.validateFile(fakeFile({ mimetype: 'image/png', originalname: 'photo.png' }))).not.toThrow();
  });

  test('accepts PDF for ownership proof documents', () => {
    expect(() => storageService.validateFile(fakeFile({ mimetype: 'application/pdf', originalname: 'receipt.pdf' }))).not.toThrow();
  });

  test('rejects disallowed mime types (e.g. executables, scripts)', () => {
    expect(() => storageService.validateFile(fakeFile({ mimetype: 'application/x-msdownload', originalname: 'virus.exe' }))).toThrow();
    expect(() => storageService.validateFile(fakeFile({ mimetype: 'text/html', originalname: 'page.html' }))).toThrow();
  });

  test('rejects a mismatched extension even with an allowed mimetype claim', () => {
    expect(() => storageService.validateFile(fakeFile({ mimetype: 'image/jpeg', originalname: 'notreally.exe' }))).toThrow();
  });

  test('rejects files over the configured size limit', () => {
    const big = fakeFile({ mimetype: 'image/jpeg', originalname: 'big.jpg', size: 2 * 1024 * 1024 });
    expect(() => storageService.validateFile(big)).toThrow(/too large/i);
  });

  test('saved files are addressed only by an opaque storage key, never a raw path the client supplied', async () => {
    const key = await storageService.saveFile(fakeFile({ mimetype: 'image/png', originalname: '../../etc/passwd.png' }), 'lost-items/test-user');
    expect(key).not.toContain('..');
    expect(key.startsWith('lost-items/test-user/')).toBe(true);
    await storageService.deleteFile(key);
  });
});
