const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true },
  affiliation: { type: String, required: true },
  id: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function() {
      return (this.authProvider || 'local') === 'local';
    }
  },
  authProvider: { type: String, enum: ['local', 'microsoft'], default: 'local' },
  microsoftOid: { type: String, default: '', index: true },
  email: { type: String, default: '' },
  position: { type: String, default: '연구원', enum: ['연구원', '파트장', '팀장', '실장', '센터장'] },
  // 관리레벨: 0(마스터 관리자) / 1(운영 관리자) / 2(대시보드 조회) / 99(일반 사용자)
  roleLevel: { type: Number, default: 99 },
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

  // 직급은 표시/인사 정보로만 보관하고, 권한은 관리레벨만 기준으로 판단한다.
  this.isAdmin = Number(this.roleLevel) <= 2;

  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
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
    ret.authProvider = ret.authProvider;
    ret.microsoftOid = ret.microsoftOid;
    ret.email = ret.email;
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
