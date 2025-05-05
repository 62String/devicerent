const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RentalHistorySchema = new Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true }, // 추가
  serialNumber: { type: String, required: true },
  userId: { type: String, required: true },
  action: { type: String, enum: ['rent', 'return'], required: true },
  timestamp: { type: Date, default: Date.now },
  userDetails: {
    name: { type: String, required: true },
    affiliation: { type: String, required: true }
  },
  deviceInfo: {
    modelName: { type: String, required: true },
    osName: { type: String, required: true },
    osVersion: { type: String, required: false, default: '' } // 수정
  },
  remark: { type: String, default: '' }
}, { strict: true });

RentalHistorySchema.index({ serialNumber: 1, timestamp: -1 });

module.exports = mongoose.model('RentalHistory', RentalHistorySchema);