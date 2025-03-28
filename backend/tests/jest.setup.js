// jest.setup.js
const mongoose = require('mongoose');

beforeAll(async () => {
  // 각 테스트 파일에서 독립적인 연결을 사용하므로 여기서는 연결 설정 불필요
}, 60000);

afterAll(async () => {
  // 각 테스트 파일에서 연결 종료 처리
}, 60000);

afterEach(async () => {
  // 각 테스트 파일에서 독립적인 연결을 사용하므로 여기서는 초기화 불필요
});