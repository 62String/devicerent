const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RentalHistorySchema = new Schema({
  serialNumber: { type: String, required: true },
  userId: { type: String, required: true },
  action: { type: String, enum: ['rent', 'return'], required: true },
  timestamp: { type: Date, default: Date.now },
  userDetails: {
    name: { type: String, required: true },
    affiliation: { type: String, required: true }
  }
});

// 인덱싱 추가
RentalHistorySchema.index({ serialNumber: 1, timestamp: -1 });

module.exports = mongoose.model('RentalHistory', RentalHistorySchema);