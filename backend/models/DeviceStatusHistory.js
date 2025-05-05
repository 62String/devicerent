const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceStatusHistorySchema = new Schema({
  serialNumber: { type: String, required: true },
  modelName: { type: String, default: 'N/A' },
  osName: { type: String, required: true },
  osVersion: { type: String, default: 'N/A' },
  status: { type: String, enum: ['active', 'repair', 'inactive'], required: true },
  statusReason: { type: String, default: '' },
  performedBy: { type: String, required: true }, // 변경 수행자
  timestamp: { type: Date, default: Date.now } // 변경 시간
}, { strict: true });

DeviceStatusHistorySchema.index({ serialNumber: 1, timestamp: -1 });

module.exports = mongoose.model('DeviceStatusHistory', DeviceStatusHistorySchema);