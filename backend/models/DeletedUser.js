const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeletedUserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  affiliation: { type: String, required: true },
  position: { type: String, enum: ['연구원', '파트장', '팀장', '실장', '센터장'] },
  isAdmin: { type: Boolean, default: false },
  isPending: { type: Boolean, default: false },
  roleLevel: { type: Number, default: 5 },
  deletedAt: { type: Date, required: true },
  reason: { type: String, default: '사유 없음' }
});

// 30일 후 자동 말소 스케줄링 (선택)
DeletedUserSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('DeletedUser', DeletedUserSchema);