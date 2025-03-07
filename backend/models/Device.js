const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceSchema = new Schema({
  id: { type: Number, required: true, unique: true }, // 고유 ID
  deviceInfo: { type: String, required: true },      // 디바이스 정보
  category: { type: String, required: true },        // 카테고리
  osVersion: { type: String },                       // OS 버전
  location: { type: String },                        // 위치
  rentedBy: { type: String, default: null },         // 대여자 (id 참조)
  rentedAt: { type: Date, default: null }            // 대여 시간
});

module.exports = mongoose.model('Device', DeviceSchema);