const User = require('../models/User');
const { verifyToken } = require('../utils/auth');
const { JWT_SECRET } = require('../config');

const getAdminLevel = (user) => {
  const level = Number(user?.roleLevel);
  return Number.isFinite(level) && level >= 0 ? level : 99;
};

const buildRequestUser = (user) => ({
  id: user.id,
  name: user.name,
  affiliation: user.affiliation,
  position: user.position,
  isAdmin: getAdminLevel(user) <= 2,
  roleLevel: getAdminLevel(user)
});

const userAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "토큰이 없습니다." });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    if (!user || user.isPending) {
      return res.status(403).json({ message: "승인된 사용자만 가능합니다." });
    }
    req.user = buildRequestUser(user);
    next();
  } catch (err) {
    res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};

const requireAdminLevel = (maxLevel, message = "권한이 부족합니다.") => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "토큰이 없습니다." });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    if (!user || user.isPending) {
      return res.status(403).json({ message: "승인된 사용자만 가능합니다." });
    }
    const level = getAdminLevel(user);
    if (level > maxLevel) {
      return res.status(403).json({ message });
    }
    req.user = buildRequestUser(user);
    next();
  } catch (err) {
    res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};

const masterAdminAuth = requireAdminLevel(0, "마스터 관리자 권한이 필요합니다.");
const adminAuth = requireAdminLevel(1, "운영 관리자 이상 권한이 필요합니다.");
const dashboardAuth = requireAdminLevel(2, "대시보드 조회 권한이 필요합니다.");

// 이전 이름 호환용. 이제 직급이 아니라 관리레벨 기준이다.
const requireRoleLevel = requireAdminLevel;

module.exports = { userAuth, adminAuth, dashboardAuth, masterAdminAuth, requireAdminLevel, requireRoleLevel, getAdminLevel };
