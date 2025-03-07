const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true },
  affiliation: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isPending: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);
