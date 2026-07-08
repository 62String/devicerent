const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceChangeRequestSchema = new Schema({
  serialNumber: { type: String, required: true, index: true },
  modelName: { type: String, default: 'N/A' },
  osName: { type: String, default: '' },
  osVersion: { type: String, default: '' },
  requestType: { type: String, enum: ['os_change', 'repair_needed'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  currentValue: { type: Schema.Types.Mixed, default: null },
  proposedValue: { type: Schema.Types.Mixed, default: null },
  reason: { type: String, default: '' },
  submittedBy: {
    id: { type: String, default: '' },
    name: { type: String, default: '' },
    affiliation: { type: String, default: '' }
  },
  reviewedBy: {
    id: { type: String, default: '' },
    name: { type: String, default: '' }
  },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: '' }
}, { timestamps: true });

DeviceChangeRequestSchema.index({ status: 1, createdAt: -1 });
DeviceChangeRequestSchema.index({ serialNumber: 1, requestType: 1, status: 1 });

module.exports = mongoose.model('DeviceChangeRequest', DeviceChangeRequestSchema);
