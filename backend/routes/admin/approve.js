const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { adminAuth } = require('../middleware');

router.get('/users/pending', adminAuth, async (req, res) => {
  console.log('Received request for /users/pending');
  try {
    const pendingUsers = await User.find({ isPending: true });
    console.log('Pending users found:', pendingUsers);
    res.json({ users: pendingUsers.map(user => ({
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      position: user.position || 'N/A'
    })) });
  } catch (err) {
    console.error('Error fetching pending users:', err);
    res.status(500).json({ message: "승인 대기 목록 조회 실패" });
  }
});

router.post('/users/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.body; // isAdmin을 req.body에서 제거
    const user = await User.findOne({ id });
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    // 기존 isAdmin 유지
    const updatedUser = await User.findOneAndUpdate(
      { id },
      { isPending: false }, // isAdmin은 수정하지 않음
      { new: true, runValidators: true }
    );
    console.log('Approved user:', updatedUser); // 디버깅 로그
    res.json({ message: "사용자가 승인되었습니다.", user: updatedUser });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post('/users/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const user = await User.findOneAndDelete({ id });
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    res.json({ message: "사용자가 거절되었습니다." });
  } catch (err) {
    console.error('Error rejecting user:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;