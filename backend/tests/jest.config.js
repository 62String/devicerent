module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  rootDir: '..',
  coveragePathIgnorePatterns: [
    '/tests/',
    '/tests/routes/',
    '/tests/server/',
    '/coverage/'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'routes/**/*.js',
    'models/**/*.js',
    'utils/**/*.js',
    'server.js',
    '!**/*.test.js',
    '!**/*.integration.test.js' // 추가 패턴
  ],
  coverageDirectory: 'tests/coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    }
  },
  verbose: true,
  reporters: ['default']
};