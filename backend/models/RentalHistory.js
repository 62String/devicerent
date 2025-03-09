const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RentalHistorySchema = new Schema({
  serialNumber: { type: String, required: true }, // 디바이스 시리얼 넘버
  userId: { type: String, required: true }, // 대여/반납한 사용자 ID
  action: { type: String, enum: ['rent', 'return'], required: true }, // 대여/반납 동작
  timestamp: { type: Date, default: Date.now }, // 기록 시간
  userDetails: { // 추가: 사용자 이름 및 소속 기록
    name: { type: String, required: true },
    affiliation: { type: String, required: true }
  }
});

module.exports = mongoose.model('RentalHistory', RentalHistorySchema);