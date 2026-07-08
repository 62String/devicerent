const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceChangeLogSchema = new Schema({
  serialNumber: { type: String, default: '', index: true },
  modelName: { type: String, default: 'N/A' },
  osName: { type: String, default: '' },
  osVersion: { type: String, default: '' },
  changeType: {
    type: String,
    enum: ['details_update', 'excel_import'],
    required: true,
    index: true
  },
  changeLabel: { type: String, required: true },
  beforeValue: { type: Schema.Types.Mixed, default: null },
  afterValue: { type: Schema.Types.Mixed, default: null },
  reason: { type: String, default: '' },
  performedBy: { type: String, default: '알 수 없음' },
  timestamp: { type: Date, default: Date.now, index: true }
}, { strict: true });

DeviceChangeLogSchema.index({ timestamp: -1 });
DeviceChangeLogSchema.index({ serialNumber: 1, timestamp: -1 });

module.exports = mongoose.model('DeviceChangeLog', DeviceChangeLogSchema);
