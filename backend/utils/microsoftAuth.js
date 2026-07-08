const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  JWT_SECRET,
  MICROSOFT_AUTHORITY,
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
  MICROSOFT_REDIRECT_URI,
} = require('../config');

const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache = { expiresAt: 0, keys: [] };

const base64UrlToBuffer = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, 'base64');
};

const decodeJwtPayload = (token) => {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Invalid JWT payload');
  return JSON.parse(base64UrlToBuffer(payload).toString('utf8'));
};

const createMicrosoftState = ({ frontendOrigin, redirectPath }) => jwt.sign(
  {
    provider: 'microsoft',
    frontendOrigin,
    redirectPath: redirectPath && redirectPath.startsWith('/') ? redirectPath : '/devices',
  },
  JWT_SECRET,
  { expiresIn: '10m' }
);

const verifyMicrosoftState = (state) => jwt.verify(state, JWT_SECRET);

const getMicrosoftAuthorizeUrl = ({ state }) => {
  const url = new URL(`${MICROSOFT_AUTHORITY}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', MICROSOFT_REDIRECT_URI);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'openid profile email User.Read');
  url.searchParams.set('state', state);
  return url.toString();
};

const exchangeCodeForTokens = async (code) => {
  const body = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    client_secret: MICROSOFT_CLIENT_SECRET,
    code,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: 'openid profile email User.Read',
  });

  const response = await fetch(`${MICROSOFT_AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Microsoft token exchange failed');
  }
  return data;
};

const getJwks = async () => {
  if (jwksCache.expiresAt > Date.now() && jwksCache.keys.length) {
    return jwksCache.keys;
  }

  const response = await fetch(`${MICROSOFT_AUTHORITY}/discovery/v2.0/keys`);
  if (!response.ok) throw new Error('Failed to fetch Microsoft JWKS');
  const data = await response.json();
  jwksCache = {
    expiresAt: Date.now() + JWKS_TTL_MS,
    keys: data.keys || [],
  };
  return jwksCache.keys;
};

const verifyMicrosoftIdToken = async (idToken) => {
  const [headerSegment] = idToken.split('.');
  const header = JSON.parse(base64UrlToBuffer(headerSegment).toString('utf8'));
  const keys = await getJwks();
  const key = keys.find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error('Microsoft signing key not found');

  const publicKey = crypto.createPublicKey({
    key: {
      kty: key.kty,
      n: key.n,
      e: key.e,
    },
    format: 'jwk',
  });

  return jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience: MICROSOFT_CLIENT_ID,
    issuer: MICROSOFT_AUTHORITY,
  });
};

const fetchMicrosoftProfile = async (accessToken) => {
  if (!accessToken) return null;
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
};

const normalizeMicrosoftUser = ({ claims, profile }) => {
  const email = profile?.mail || profile?.userPrincipalName || claims.preferred_username || claims.email || claims.upn;
  const microsoftOid = claims.oid || profile?.id || claims.sub;
  const name = profile?.displayName || claims.name || email;
  const affiliation = profile?.department || '미지정';
  const position = '연구원';

  if (!email) throw new Error('Microsoft account email is missing');
  if (!microsoftOid) throw new Error('Microsoft account oid is missing');

  return {
    id: email.toLowerCase(),
    email: email.toLowerCase(),
    microsoftOid,
    name,
    affiliation,
    position,
  };
};

module.exports = {
  createMicrosoftState,
  verifyMicrosoftState,
  getMicrosoftAuthorizeUrl,
  exchangeCodeForTokens,
  verifyMicrosoftIdToken,
  fetchMicrosoftProfile,
  normalizeMicrosoftUser,
  decodeJwtPayload,
};
