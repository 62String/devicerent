const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserRoleChangeLogSchema = new Schema({
  targetUserId: { type: String, required: true, index: true },
  targetUserName: { type: String, default: '' },
  previousRoleLevel: { type: Number, required: true },
  newRoleLevel: { type: Number, required: true },
  reason: { type: String, default: '' },
  performedBy: { type: String, required: true, index: true },
  performedByName: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true }
}, { strict: true });

UserRoleChangeLogSchema.index({ targetUserId: 1, timestamp: -1 });

module.exports = mongoose.model('UserRoleChangeLog', UserRoleChangeLogSchema);
