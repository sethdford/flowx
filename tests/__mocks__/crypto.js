/**
 * Mock crypto module for Jest tests
 */

const crypto = jest.createMockFromModule('crypto');

// Mock common crypto functions
crypto.randomBytes = jest.fn((size) => Buffer.alloc(size));
crypto.randomUUID = jest.fn(() => 'mock-uuid-12345678-1234-1234-1234-123456789012');
crypto.createHash = jest.fn(() => ({
  update: jest.fn().mockReturnThis(),
  digest: jest.fn(() => 'mock-hash')
}));
crypto.createHmac = jest.fn(() => ({
  update: jest.fn().mockReturnThis(),
  digest: jest.fn(() => 'mock-hmac')
}));
crypto.pbkdf2 = jest.fn((password, salt, iterations, keylen, digest, cb) => {
  cb(null, Buffer.from('mock-key'));
});
crypto.pbkdf2Sync = jest.fn(() => Buffer.from('mock-key'));
crypto.scrypt = jest.fn((password, salt, keylen, cb) => {
  cb(null, Buffer.from('mock-key'));
});
crypto.scryptSync = jest.fn(() => Buffer.from('mock-key'));

module.exports = crypto; 