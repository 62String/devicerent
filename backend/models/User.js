const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true },
  affiliation: { type: String, required: true },
  id: { type: String, required: true, unique: true },
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

// toJSON 옵션 추가
UserSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret.id;
    ret.name = ret.name;
    ret.affiliation = ret.affiliation;
    ret.isPending = ret.isPending;
    ret.isAdmin = ret.isAdmin;
    delete ret.password; // 비밀번호 제거
    delete ret.__v; // 버전 필드 제거
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);