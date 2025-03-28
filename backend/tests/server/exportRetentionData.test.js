const request = require('supertest');
const { exportRetentionData } = require('../../server');
const RentalHistory = require('../../models/RentalHistory');
const mongoose = require('mongoose');

describe('exportRetentionData', () => {
  let testConnection;

  beforeAll(async () => {
    testConnection = mongoose.createConnection('mongodb://localhost:27017/devicerent-test', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });
    const RentalHistoryModel = testConnection.model('RentalHistory', RentalHistory.schema);
    RentalHistory.find = RentalHistoryModel.find.bind(RentalHistoryModel);
    RentalHistory.deleteMany = RentalHistoryModel.deleteMany.bind(RentalHistoryModel);
  }, 60000);

  afterAll(async () => {
    await testConnection.dropDatabase();
    await testConnection.close();
  }, 60000);

  it('should export retention data', async () => {
    // 실제 데이터 삽입 및 테스트
  }, 10000);
});