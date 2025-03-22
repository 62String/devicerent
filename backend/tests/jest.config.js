// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/jest.setup.js'],
  coveragePathIgnorePatterns: [
    '/routes/',
    '/models/DeletedUser.js',
    '/models/RentalHistory.js'
  ]
};