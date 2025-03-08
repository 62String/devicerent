const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { adminAuth } = require('../middleware');

router.get('/', adminAuth, async (req, res) => { // /users → /
  try {
    const users = await User.find({ isPending: false });
    res.json(users.map(user => ({
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      isAdmin: user.isAdmin,
      isPending: user.isPending
    })));
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.get('/users/pending', adminAuth, async (req, res) => {
    console.log('Received request for /pending');
    try {
      const pendingUsers = await User.find({ isPending: true });
      console.log('Pending users found:', pendingUsers);
      res.json({ users: pendingUsers.map(user => ({
        id: user.id,
        name: user.name,
        affiliation: user.affiliation
      })) });
    } catch (err) {
      console.error('Error fetching pending users:', err);
      res.status(500).json({ message: "승인 대기 목록 조회 실패" });
    }
  });

module.exports = router;