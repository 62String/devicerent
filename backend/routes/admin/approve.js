const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { adminAuth } = require('../middleware');

router.post('/requests/approve', adminAuth, async (req, res) => {
  try {
    const { id, isAdmin = false } = req.body;
    const user = await User.findOneAndUpdate({ id }, { isPending: false, isAdmin }, { new: true });
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    res.json({ message: "사용자가 승인되었습니다." });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.post('/requests/reject', adminAuth, async (req, res) => {
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