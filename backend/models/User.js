const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true },
  affiliation: { type: String, required: true },
  id: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  position: { type: String, required: true, enum: ['연구원', '파트장', '팀장', '실장', '센터장'] },
  roleLevel: { type: Number, default: 5 },
  isPending: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false }
});

UserSchema.pre('save', async function(next) {
  const user = this;

  // 비밀번호 해싱
  if (user.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }

  // 직급에 따라 권한 레벨 설정 (역순)
  if (user.isModified('position')) {
    if (user.position === '센터장') user.roleLevel = 1;
    else if (user.position === '실장') user.roleLevel = 2;
    else if (user.position === '팀장') user.roleLevel = 3;
    else if (user.position === '파트장') user.roleLevel = 4;
    else if (user.position === '연구원') user.roleLevel = 5;
  }

  // 파트장 이상 직급에 대해 isAdmin: true 설정
  if (['파트장', '팀장', '실장', '센터장'].includes(this.position)) {
    this.isAdmin = true;
  } else {
    this.isAdmin = false;
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
    ret.position = ret.position;
    ret.roleLevel = ret.roleLevel;
    ret.isPending = ret.isPending;
    ret.isAdmin = ret.isAdmin;
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);