const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceSchema = new Schema({
  serialNumber: { 
    type: String, 
    required: true, 
    unique: process.env.NODE_ENV === 'test' ? false : true // 테스트 환경에서는 unique 제약 비활성화
  },
  deviceInfo: { type: String, required: true },
  osName: { type: String, required: true },
  osVersion: { type: String, default: '' },
  modelName: { type: String, default: '' },
  rentedBy: { 
    type: {
      name: { type: String },
      affiliation: { type: String }
    },
    default: null
  },
  rentedAt: { type: Date, default: null },
  // 대여 유형: normal(일반 단기대여) / longterm(장기대여·출장 등).
  rentalType: { type: String, enum: ['normal', 'longterm'], default: 'normal' },
  // 장기대여 승인 상태: none(일반대여) / pending(승인 대기) / approved(승인 완료).
  // 회수 대상(장기 미반납) 판정은 normal 또는 pending에만 적용 — approved는 제외.
  longTermStatus: { type: String, enum: ['none', 'pending', 'approved'], default: 'none' },
  approvedBy: { type: String, default: '' },   // 승인한 책임자 이름(팀장 이상)
  approvedAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'repair', 'inactive'], default: 'active' },
  statusReason: { type: String, default: '' },
  remark: { type: String, default: '' },
  details: {
    type: {
      sourceSheet: { type: String, default: '' },
      sourceStatus: { type: String, default: '' },
      category: { type: String, default: '' },
      manufacturer: { type: String, default: '' },
      modelNumber: { type: String, default: '' },
      chipset: { type: String, default: '' },
      cpu: { type: String, default: '' },
      gpu: { type: String, default: '' },
      memory: { type: String, default: '' },
      bluetooth: { type: String, default: '' },
      screenSize: { type: String, default: '' },
      resolution: { type: String, default: '' },
      registeredAt: { type: String, default: '' },
      checkedAt: { type: String, default: '' },
      note: { type: String, default: '' },
      udid: { type: String, default: '' }
    },
    default: () => ({})
  }
});

module.exports = mongoose.model('Device', DeviceSchema);
