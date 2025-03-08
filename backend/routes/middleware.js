const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../utils/auth');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const adminAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "토큰이 없습니다." });
  try {
    const decoded = await verifyToken(token, JWT_SECRET);
    console.log('Decoded token:', decoded);
    if (!decoded.id || !(await User.findOne({ id: decoded.id, isAdmin: true }))) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다." });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};

module.exports = { adminAuth };