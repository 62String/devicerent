const jwt = require('jsonwebtoken');

const verifyToken = async (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = { verifyToken };