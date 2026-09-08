const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const DeletedUser = require('../../models/DeletedUser');
const UserRoleChangeLog = require('../../models/UserRoleChangeLog');
const { adminAuth, masterAdminAuth } = require('../middleware');

const ALLOWED_ADMIN_LEVELS = [0, 1, 2, 99];

router.get('/users/pending', adminAuth, async (req, res) => {
  console.log('Received request for /users/pending');
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

router.get('/users', masterAdminAuth, async (req, res) => { // 추가된 엔드포인트
  console.log('Received request for /users');
  try {
    const users = await User.find({ isPending: false }); // 승인된 사용자만 조회
    console.log('Users found:', users);
    res.json({ users: users.map(user => ({
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      isAdmin: Number(user.roleLevel) <= 2,
      roleLevel: Number.isFinite(Number(user.roleLevel)) ? Number(user.roleLevel) : 99
    })) });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: "사용자 목록 조회 실패", error: err.message });
  }
});

router.post('/users/role-level', masterAdminAuth, async (req, res) => {
  try {
    const { id, roleLevel, reason } = req.body;
    const nextRoleLevel = Number(roleLevel);

    if (!id || !ALLOWED_ADMIN_LEVELS.includes(nextRoleLevel)) {
      return res.status(400).json({ message: "유효한 사용자와 관리레벨을 선택해주세요." });
    }
    if (id === req.user.id) {
      return res.status(403).json({ message: "본인의 관리레벨은 변경할 수 없습니다." });
    }

    const targetUser = await User.findOne({ id, isPending: false });
    if (!targetUser) {
      return res.status(404).json({ message: "승인된 사용자를 찾을 수 없습니다." });
    }

    const previousRoleLevel = Number.isFinite(Number(targetUser.roleLevel))
      ? Number(targetUser.roleLevel)
      : 99;
    if (previousRoleLevel === nextRoleLevel) {
      return res.status(400).json({ message: "현재와 다른 관리레벨을 선택해주세요." });
    }

    targetUser.roleLevel = nextRoleLevel;
    targetUser.isAdmin = nextRoleLevel <= 2;
    await targetUser.save();

    await UserRoleChangeLog.create({
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      previousRoleLevel,
      newRoleLevel: nextRoleLevel,
      reason: typeof reason === 'string' ? reason.trim() : '',
      performedBy: req.user.id,
      performedByName: req.user.name
    });

    return res.json({
      message: "관리레벨이 변경되었습니다.",
      user: {
        id: targetUser.id,
        name: targetUser.name,
        affiliation: targetUser.affiliation,
        roleLevel: nextRoleLevel,
        isAdmin: nextRoleLevel <= 2
      }
    });
  } catch (err) {
    console.error('Error updating user role level:', err);
    return res.status(500).json({ message: "관리레벨 변경 중 서버 오류가 발생했습니다." });
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
      isAdmin: Number(user.roleLevel) <= 2,
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

router.post('/users/delete', masterAdminAuth, async (req, res) => {
  try {
    const { id, reason } = req.body;
    const adminUser = await User.findOne({ id: req.user.id });
    const targetUser = await User.findOne({ id });

    if (!targetUser) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    if (targetUser.id === adminUser.id) return res.status(403).json({ message: "본인 계정은 삭제할 수 없습니다." });
    const adminLevel = Number.isFinite(Number(adminUser.roleLevel)) ? Number(adminUser.roleLevel) : 99;
    const targetLevel = Number.isFinite(Number(targetUser.roleLevel)) ? Number(targetUser.roleLevel) : 99;
    if (targetLevel <= adminLevel) {
      return res.status(403).json({ message: "상위 또는 동일 관리레벨은 삭제할 수 없습니다." });
    }

    await DeletedUser.create({
      id: targetUser.id,
      name: targetUser.name,
      affiliation: targetUser.affiliation,
      position: targetUser.position,
      isAdmin: Number(targetUser.roleLevel) <= 2,
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
