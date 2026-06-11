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

module.exports = { adminAuth };
