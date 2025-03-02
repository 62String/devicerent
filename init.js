const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  affiliation: { type: String, required: true },
  isPending: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

module.exports = { User };