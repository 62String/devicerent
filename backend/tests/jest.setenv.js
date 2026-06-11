// 테스트 전역 환경 — 모든 테스트 파일이 동일한 시크릿을 쓰도록 고정
// (dotenv.config()는 이미 설정된 env를 덮어쓰지 않음)
process.env.JWT_SECRET = '비밀열쇠12345678';
