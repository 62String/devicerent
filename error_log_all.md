# DeviceRentalApi 에러 로그 (2025년 3월 1일)

## 포트 충돌 에러 (`EADDRINUSE: address already in use :::4000`)
- **원인**: 포트 4000이 다른 프로세스에 의해 점유됨.
- **해결 과정**: PowerShell에서 `netstat -aon | findstr :4000`로 점유 프로세스 확인, `taskkill /F /PID <PID>`로 프로세스 종료, `node server.js`로 서버 재실행.

## MongoDB 연결 경고 (`useNewUrlParser`, `useUnifiedTopology` deprecated)
- **원인**: Mongoose 연결 옵션(`useNewUrlParser`, `useUnifiedTopology`) 비권장, but 기능 영향 없음.
- **해결 과정**: `mongoose.connect('mongodb://localhost:27017/devicerent')`로 옵션 제거, `server.js` 코드 수정 후 재실행.

## `mongo`/`mongosh` 명령어 인식 실패
- **원인**: Windows 환경 변수(`Path`)에 `C:\Program Files\MongoDB\Server\8.0\bin` 누락, PowerShell 재시작/Windows 재부팅 누락, `mongosh.exe` 설치 미흡.
- **해결 과정**: "시스템 변수" `Path`에 `C:\Program Files\MongoDB\Server\8.0\bin` 추가, PowerShell 재시작/Windows 재부팅, `mongosh.msi` 다운로드/설치 후 `Path`에 설치 경로 추가.

## "Invalid credentials" 로그인 실패
- **원인**: MongoDB `devicerent` 데이터베이스에 `user1` 사용자 데이터 누락, `init.js` 파일 없음, 비밀번호 해시 불일치.
- **해결 과정**: `init.js` 생성/수정(사용자 데이터 생성 코드 작성), `node init.js` 실행, `mongosh`로 데이터 확인(`db.users.find()`), 로그인 재시도.

## `init.js` 실행 오류 (`SyntaxError: Missing semicolon`)
- **원인**: `init.js` 파일 첫 줄에 JavaScript 구문 오류(세미콜론 누락).
- **해결 과정**: `init.js` 코드 검토/수정(세미콜론 추가), `node init.js` 재실행.

## `mongosh` 명령어 인식 실패
- **원인**: `mongosh.exe` 설치 누락, `Path`에 설치 경로 추가 안 됨, PowerShell 재시작/Windows 재부팅 누락.
- **해결 과정**: `https://www.mongodb.com/try/download/shell`에서 `mongosh.msi` 다운로드/설치, "시스템 변수" `Path`에 설치 경로(`C:\Program Files\mongosh\`) 추가, PowerShell 재시작/Windows 재부팅.

## `mongo.exe` 실행 오류 (경로 공백 문제)
- **원인**: PowerShell에서 `C:\Program Files\MongoDB\Server\8.0\bin\mongo.exe` 경로에 공백 포함, 따옴표/이스케이프 누락.
- **해결 과정**: 경로를 따옴표로 감싸 실행: `& "C:\Program Files\MongoDB\Server\8.0\bin\mongo.exe" --version`, or `mongosh`로 대체 권장.

### 상사 보고용 요약
- **문제 해결 능력**: 에러 원인 분석(환경 설정, 데이터 누락, 코드 오류)과 단계별 해결(설치, 권한, 경로 설정)로 프로젝트 진행.
- **배운 교훈**: 환경 변수 관리, PowerShell/재부팅 확인, 초기 데이터 설정 중요, 에러 로그로 반복 방지.
- **향후 계획**: 에러 로그 지속 기록, 기술 학습/문제 해결 연습으로 신뢰도 강화.