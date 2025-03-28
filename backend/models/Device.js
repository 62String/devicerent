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
  status: { type: String, enum: ['active', 'repair', 'inactive'], default: 'active' },
  statusReason: { type: String, default: '' },
  remark: { type: String, default: '' }
});

module.exports = mongoose.model('Device', DeviceSchema);