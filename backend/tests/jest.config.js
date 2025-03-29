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
    '!**/*.integration.test.js'
  ],
  coverageDirectory: 'tests/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    }
  },
  verbose: true,
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: 'tests/html-report',
        filename: 'report.html',
        expand: true,
        pageTitle: 'DeviceRentalApi Test Report',
        includeCoverage: true,
        openReport: false
      }
    ]
  ]
};