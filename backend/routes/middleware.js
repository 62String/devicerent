const User = require('../models/User');
const { verifyToken } = require('../utils/auth');
const { JWT_SECRET } = require('../config');

const adminAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "토큰이 없습니다." });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다." });
    }
    req.user = {
      id: user.id,
      name: user.name,
      isAdmin: user.isAdmin,
      roleLevel: user.roleLevel || 5
    };
    next();
  } catch (err) {
    res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};

// roleLevel 기반 게이트 (센터장1 / 실장2 / 팀장3 / 파트장4 / 연구원5).
// maxLevel 이하(=상위 직급)만 통과. 예: requireRoleLevel(3) → 팀장 이상.
const requireRoleLevel = (maxLevel) => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "토큰이 없습니다." });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
    const level = user.roleLevel || 5;
    if (level > maxLevel) {
      return res.status(403).json({ message: "권한이 부족합니다. 팀장 이상만 가능합니다." });
    }
    req.user = { id: user.id, name: user.name, isAdmin: user.isAdmin, roleLevel: level };
    next();
  } catch (err) {
    res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};

module.exports = { adminAuth, requireRoleLevel };
