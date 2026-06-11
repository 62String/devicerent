const isTest = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

// 테스트 환경에서만 고정 시크릿 허용 — 운영/개발은 환경변수 필수
const JWT_SECRET = process.env.JWT_SECRET || (isTest ? '비밀열쇠12345678' : null);
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. .env 또는 docker-compose 환경을 확인하세요.');
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const isPrivateHostname = (hostname) => (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  try {
    const { protocol, hostname, port } = new URL(origin);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      port === '3000' &&
      isPrivateHostname(hostname)
    );
  } catch (error) {
    return false;
  }
};

module.exports = {
  JWT_SECRET,
  ALLOWED_ORIGINS,
  isAllowedOrigin,
  PORT: process.env.PORT || 4000,
  isTest,
};
