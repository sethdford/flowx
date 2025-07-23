/**
 * Mock for sql.js module
 */

const mockDatabase = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    getAsObject: jest.fn().mockReturnValue({ count: 0 }),
    step: jest.fn(),
    bind: jest.fn(),
    reset: jest.fn(),
    free: jest.fn(),
    finalize: jest.fn()
  })),
  close: jest.fn(),
  export: jest.fn().mockReturnValue(new Uint8Array())
};

const mockSqlJs = jest.fn().mockResolvedValue({
  Database: jest.fn(() => mockDatabase)
});

module.exports = mockSqlJs; 