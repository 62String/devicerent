const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { adminAuth } = require('../middleware');

router.get('/requests', adminAuth, async (req, res) => {
  try {
    const pendingUsers = await User.find({ isPending: true });
    res.json(pendingUsers);
  } catch (err) {
    console.error('Error fetching pending users:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;