module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  coveragePathIgnorePatterns: [],
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