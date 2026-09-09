const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
  JWT_SECRET,
  MICROSOFT_AUTH_ENABLED,
} = require('../config');
const {
  createMicrosoftState,
  verifyMicrosoftState,
  getMicrosoftAuthorizeUrl,
  exchangeCodeForTokens,
  verifyMicrosoftIdToken,
  fetchMicrosoftProfile,
  normalizeMicrosoftUser,
} = require('../utils/microsoftAuth');

router.post('/register', async (req, res) => {
  const { name, affiliation, id, password, passwordConfirm, position } = req.body;
  if (!name || !affiliation || !id || !password || !passwordConfirm) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (typeof id !== 'string' || id.trim().length < 3 || !/^[a-zA-Z0-9_@.\-]+$/.test(id.trim())) {
    return res.status(400).json({ message: '아이디는 영어, 숫자, _, -, @, .만 사용 가능하며 최소 3자 이상이어야 합니다.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  if (password !== passwordConfirm) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const existingUser = await User.findOne({ id: id.trim() });
    if (existingUser) return res.status(400).json({ message: "이미 존재하는 ID입니다." });

    const user = new User({
      name,
      affiliation,
      id: id.trim(),
      password,
      position: position || '연구원',
      isPending: true,
      roleLevel: 99,
      isAdmin: false
    });
    await user.save();

    res.status(201).json({ message: "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.", user: { id: id.trim(), name, affiliation } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post('/check-id', async (req, res) => {
  const { id } = req.body;
  if (typeof id !== 'string' || id.trim().length < 3 || !/^[a-zA-Z0-9_@.\-]+$/.test(id.trim())) {
    return res.status(400).json({ available: false, message: '올바른 아이디를 입력해주세요. 최소 3자 이상이어야 합니다.' });
  }
  try {
    const existingUser = await User.findOne({ id: id.trim() });
    if (existingUser) {
      return res.json({ available: false, message: existingUser.isPending
        ? '이미 가입 신청된 아이디입니다. 관리자 승인 대기 중입니다.'
        : '이미 사용 중인 아이디입니다. 로그인하거나 다른 아이디를 입력해주세요.' });
    }
    res.json({ available: true, message: '사용 가능한 아이디입니다.' });
  } catch (error) {
    console.error('Check ID error:', error);
    res.status(500).json({ message: '서버 오류' });
  }
});

router.post('/login', async (req, res) => {
  const { id, password } = req.body;
  try {
    const user = await User.findOne({ id: id.trim() });
    if (!user) {
      return res.status(401).json({ message: "등록되지 않은 사용자 혹은 아이디가 틀렸습니다." });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }
    if (user.isPending) {
      return res.status(403).json({ message: "가입 신청이 접수되었으며 관리자 승인 대기 중입니다. 승인 완료 후 로그인해주세요." });
    }
    const adminLevel = Number.isFinite(Number(user.roleLevel)) ? Number(user.roleLevel) : 99;
    const token = jwt.sign({ id: user.id, roleLevel: adminLevel }, JWT_SECRET, { expiresIn: adminLevel <= 2 ? '365d' : '1h' });
    res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get('/microsoft/config', (req, res) => {
  res.json({ enabled: MICROSOFT_AUTH_ENABLED });
});

router.get('/microsoft/start', (req, res) => {
  if (!MICROSOFT_AUTH_ENABLED) {
    return res.status(503).json({ message: 'Microsoft 로그인 설정이 아직 완료되지 않았습니다.' });
  }

  const frontendOrigin = req.get('origin') || `${req.protocol}://${req.get('host')}`.replace(':4000', ':3000');
  const redirectPath = typeof req.query.redirect === 'string' ? req.query.redirect : '/portal';
  const state = createMicrosoftState({ frontendOrigin, redirectPath });
  res.redirect(getMicrosoftAuthorizeUrl({ state }));
});

router.get('/microsoft/callback', async (req, res) => {
  if (!MICROSOFT_AUTH_ENABLED) {
    return res.status(503).send('Microsoft login is not configured');
  }

  const { code, state, error, error_description: errorDescription } = req.query;
  let verifiedState;

  try {
    verifiedState = verifyMicrosoftState(state);
    if (error) {
      throw new Error(errorDescription || error);
    }
    if (!code) {
      throw new Error('Authorization code is missing');
    }

    const tokens = await exchangeCodeForTokens(code);
    const claims = await verifyMicrosoftIdToken(tokens.id_token);
    const profile = await fetchMicrosoftProfile(tokens.access_token);
    const microsoftUser = normalizeMicrosoftUser({ claims, profile });

    let user = await User.findOne({
      $or: [
        { microsoftOid: microsoftUser.microsoftOid },
        { email: microsoftUser.email },
        { id: microsoftUser.id },
      ]
    });

    if (!user) {
      user = await User.create({
        id: microsoftUser.id,
        email: microsoftUser.email,
        microsoftOid: microsoftUser.microsoftOid,
        authProvider: 'microsoft',
        name: microsoftUser.name,
        affiliation: microsoftUser.affiliation,
        position: microsoftUser.position,
        isPending: false,
        roleLevel: 99,
        isAdmin: false,
      });
    } else {
      user.authProvider = user.authProvider || 'microsoft';
      user.microsoftOid = user.microsoftOid || microsoftUser.microsoftOid;
      user.email = user.email || microsoftUser.email;
      user.name = microsoftUser.name || user.name;
      user.affiliation = microsoftUser.affiliation || user.affiliation;
      await user.save();
    }

    if (user.isPending) {
      throw new Error('승인 대기중');
    }

    const adminLevel = Number.isFinite(Number(user.roleLevel)) ? Number(user.roleLevel) : 99;
    const appToken = jwt.sign({ id: user.id, roleLevel: adminLevel }, JWT_SECRET, { expiresIn: adminLevel <= 2 ? '365d' : '1h' });
    const callbackUrl = new URL('/auth/microsoft/callback', verifiedState.frontendOrigin);
    callbackUrl.searchParams.set('token', appToken);
    callbackUrl.searchParams.set('redirect', verifiedState.redirectPath || '/portal');
    return res.redirect(callbackUrl.toString());
  } catch (callbackError) {
    const frontendOrigin = verifiedState?.frontendOrigin || `${req.protocol}://${req.get('host')}`.replace(':4000', ':3000');
    const callbackUrl = new URL('/auth/microsoft/callback', frontendOrigin);
    callbackUrl.searchParams.set('error', callbackError.message || 'Microsoft login failed');
    return res.redirect(callbackUrl.toString());
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    const returnData = {
      id: user.id,
      name: user.name,
      affiliation: user.affiliation,
      roleLevel: Number.isFinite(Number(user.roleLevel)) ? Number(user.roleLevel) : 99,
      isPending: user.isPending || false,
      isAdmin: Number(user.roleLevel) <= 2,
      authProvider: user.authProvider || 'local',
      email: user.email || ''
    };
    res.json({ user: returnData });
  } catch (error) {
    console.error('Error fetching user:', error.name, error.message);
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
