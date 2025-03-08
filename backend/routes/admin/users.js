const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { adminAuth } = require('../middleware');

router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ isPending: false });
    res.json(users.map(user => ({
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      isAdmin: user.isAdmin
    })));
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;