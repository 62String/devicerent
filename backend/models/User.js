const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true },        // 이름
  affiliation: { type: String, required: true }, // 소속
  id: { type: String, required: true, unique: true }, // 고유 식별자 (원래 username)
  password: { type: String, required: true },
  isPending: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false }
});

UserSchema.pre('save', async function(next) {
  const user = this;
  if (user.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);