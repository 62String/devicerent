module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  coveragePathIgnorePatterns: [
    '../routes/',
    '../models/DeletedUser.js',
    '../models/RentalHistory.js',
    '../server.js',
    '../utils/auth.js'
  ],
  reporters: [
    'default',
    [
      'jest-allure2-reporter',
      {
        outputDir: 'allure-results'
      }
    ]
  ]
};