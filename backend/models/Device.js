const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  deviceInfo: { type: String, required: true },
  category: { type: String },
  osVersion: { type: String },
  location: { type: String },
  rentedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rentedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Device', DeviceSchema);
