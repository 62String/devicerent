const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const DeletedUser = require('../../models/DeletedUser');
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

router.get('/users', adminAuth, async (req, res) => { // 추가된 엔드포인트
  console.log('Received request for /users');
  try {
    const users = await User.find({ isPending: false }); // 승인된 사용자만 조회
    console.log('Users found:', users);
    res.json({ users: users.map(user => ({
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      position: user.position || 'N/A',
      isAdmin: user.isAdmin,
      roleLevel: user.roleLevel
    })) });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: "사용자 목록 조회 실패", error: err.message });
  }
});

router.post('/users/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const user = await User.findOne({ id });
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    const updatedUser = await User.findOneAndUpdate(
      { id },
      { isPending: false },
      { new: true, runValidators: true }
    );
    console.log('Approved user:', updatedUser);
    res.json({ message: "사용자가 승인되었습니다.", user: updatedUser });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post('/users/reject', adminAuth, async (req, res) => {
  try {
    const { id, reason } = req.body;
    const user = await User.findOne({ id });
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    await DeletedUser.create({
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      position: user.position,
      isAdmin: user.isAdmin,
      isPending: user.isPending,
      roleLevel: user.roleLevel,
      deletedAt: new Date(),
      reason: reason || '거부 사유 없음'
    });

    await User.findOneAndDelete({ id });
    res.json({ message: "사용자가 거절되었습니다." });
  } catch (err) {
    console.error('Error rejecting user:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post('/users/delete', adminAuth, async (req, res) => {
  try {
    const { id, reason } = req.body;
    const adminUser = await User.findOne({ id: req.user.id });
    const targetUser = await User.findOne({ id });

    if (!targetUser) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    if (targetUser.id === adminUser.id) return res.status(403).json({ message: "본인 계정은 삭제할 수 없습니다." });
    if (targetUser.roleLevel <= adminUser.roleLevel) return res.status(403).json({ message: "상위 또는 동일 직급은 삭제할 수 없습니다." });

    await DeletedUser.create({
      id: targetUser.id,
      name: targetUser.name,
      affiliation: targetUser.affiliation,
      position: targetUser.position,
      isAdmin: targetUser.isAdmin,
      isPending: targetUser.isPending,
      roleLevel: targetUser.roleLevel,
      deletedAt: new Date(),
      reason: reason || '삭제 사유 없음'
    });

    await User.findOneAndDelete({ id });
    res.json({ message: "사용자가 삭제되었습니다." });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;