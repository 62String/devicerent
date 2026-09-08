# DeviceRent 신규 서버 PC 시운전 인수인계서

작성일: 2026-09-08  
대상: 신규 Windows 사내 서버 PC  
목적: 새 로컬 서버 환경에서 DeviceRent를 GitHub 최신 소스로 받아 Docker Compose 기반으로 실행하고, 실제 시운전 가능한 상태까지 구성한다.

---

## 1. 작업 원칙

이 문서는 실행 에이전트가 순서대로 따라 할 수 있는 절차서다.  
감독자는 각 단계의 정상 기준만 확인하고, 위험 작업은 실행 전 승인한다.

반드시 지킬 것:

- 운영 또는 시운전 DB 초기화는 감독자 승인 후 진행한다.
- `frontend/dist`, `coverage`, `html-report`, `backend/exports` 산출물은 커밋하지 않는다.
- MongoDB `27017` 포트는 외부에 열지 않는다.
- 프론트 접속 포트는 `3000`, 백엔드 API 포트는 `4000`이다.
- 신규 서버의 유선 LAN IP가 바뀌면 `.env`의 `ALLOWED_ORIGINS`를 해당 IP에 맞게 다시 설정한다.

---

## 2. 시스템 구성 요약

DeviceRent는 3개 컨테이너로 실행된다.

| 구분 | 컨테이너 | 역할 | 외부 포트 |
|---|---|---|---|
| frontend | `devicerentalapi-frontend-1` | React/Vite 화면 서버 | `3000` |
| backend | `devicerentalapi-backend-1` | Node.js/Express API 서버 | `4000` |
| mongo | `mongo` | MongoDB 데이터 저장소 | 외부 미개방 |

기본 접속 주소:

- 서버 PC 내부: `http://localhost:3000`
- 사내망 PC: `http://<서버_유선_LAN_IP>:3000`
- API 확인: `http://<서버_유선_LAN_IP>:4000/api/me` 등

프론트는 `VITE_API_URL`이 비어 있으면 접속한 브라우저 hostname 기준으로 API 주소를 자동 계산한다.  
예: `http://192.168.0.143:3000`으로 접속하면 API는 `http://192.168.0.143:4000`을 사용한다.

---

## 3. 신규 서버 PC 사전 준비

### 3.1 필수 설치

신규 서버 PC에 아래 항목이 설치되어 있어야 한다.

- Git
- Docker Desktop
- 웹 브라우저 Chrome 또는 Edge
- Windows PowerShell

Docker Desktop 실행 조건:

- BIOS/UEFI에서 CPU Virtualization 활성화
- Windows 기능에서 WSL2 사용 가능
- Docker Desktop이 정상 실행되어야 함

확인 명령:

```powershell
git --version
docker version
docker compose version
wsl --status
```

정상 기준:

- `docker version`에서 Client와 Server 정보가 모두 표시된다.
- Docker Desktop 오류 창이 뜨지 않는다.
- `docker compose version`이 정상 출력된다.

---

## 4. 소스 코드 준비

### 4.1 저장소 받기

신규 PC에서 작업할 위치를 정한 뒤 저장소를 받는다.

```powershell
cd C:\Users\<사용자>\Projects
git clone <GitHub_저장소_URL> DEVICERENTALAPI
cd DEVICERENTALAPI
```

이미 저장소가 있다면:

```powershell
cd C:\Users\<사용자>\Projects\DEVICERENTALAPI
git fetch --all --prune
git status
```

### 4.2 브랜치 선택

현재 개발 기준 브랜치는 `dev`다.  
시운전용으로 검증된 상태를 쓰기로 했다면 `release` 브랜치를 사용한다.

```powershell
git branch --show-current
git checkout dev
git pull origin dev
```

또는 release 기준:

```powershell
git checkout release
git pull origin release
```

정상 기준:

- `git status`에서 불필요한 변경사항이 없어야 한다.
- 실행 브랜치가 사전에 합의한 브랜치여야 한다.

---

## 5. 신규 서버 IP 확인

유선 LAN IPv4 주소를 확인한다.

```powershell
Get-NetIPConfiguration | Where-Object {
  $_.IPv4DefaultGateway -ne $null
} | Select-Object InterfaceAlias, IPv4Address, IPv4DefaultGateway
```

확인할 값:

- Wi-Fi가 아니라 유선 LAN 어댑터의 IPv4 주소
- 예: `192.168.0.143`

이 문서에서는 이후 `<서버IP>`로 표기한다.

---

## 6. 환경변수 설정

프로젝트 루트에 `.env` 파일을 만든다. 이미 있으면 신규 서버 기준으로 값을 확인한다.

```powershell
notepad .env
```

기본 예시:

```env
JWT_SECRET=<충분히_긴_랜덤_문자열>
ALLOWED_ORIGINS=http://localhost:3000,http://<서버IP>:3000
VITE_API_URL=

MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=
```

`JWT_SECRET` 생성 예시:

```powershell
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

주의:

- `JWT_SECRET`은 운영 중간에 바꾸면 기존 로그인 토큰이 모두 무효화된다.
- `VITE_API_URL`은 비워둔다.
- Microsoft SSO를 바로 쓸 경우에만 `MICROSOFT_*` 값을 입력한다.
- Microsoft SSO를 쓰지 않으면 Microsoft 365 로그인 버튼은 비활성화된다.

---

## 7. Windows 방화벽 설정

관리자 권한 PowerShell에서 실행한다.

```powershell
New-NetFirewallRule -DisplayName "DeviceRent Frontend 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "DeviceRent Backend 4000" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow
```

정상 기준:

- 같은 사내망 PC에서 `http://<서버IP>:3000` 접속 가능
- API는 브라우저 또는 curl로 `http://<서버IP>:4000` 접근 가능

MongoDB `27017`은 외부 방화벽에서 열지 않는다.

---

## 8. Docker Compose 실행

프로젝트 루트에서 실행한다.

```powershell
docker compose up -d --build
```

상태 확인:

```powershell
docker compose ps
```

정상 기준:

- `frontend` Up
- `backend` Up
- `mongo` Up 또는 healthy
- 포트 매핑:
  - `0.0.0.0:3000->3000/tcp`
  - `0.0.0.0:4000->4000/tcp`
  - MongoDB는 외부 포트 미노출

로그 확인:

```powershell
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose logs --tail=100 mongo
```

---

## 9. 접속 확인

서버 PC에서:

```powershell
curl.exe -I http://localhost:3000
curl.exe -I http://localhost:3000/portal
curl.exe -I http://localhost:4000/api/auth/microsoft/config
```

사내망 다른 PC에서:

```text
http://<서버IP>:3000
```

정상 플로우:

1. 로그인 페이지 접속
2. 로그인 성공
3. 포털 페이지 표시
4. `DeviceRent` 선택
5. `/devices` 대여하기 페이지 이동

---

## 10. 초기 관리자 계정 준비

### 10.1 기본 방식

가장 안전한 방식은 가입 신청 후 DB에서 해당 계정을 승인/권한 부여하는 것이다.

1. 브라우저에서 `http://<서버IP>:3000/register`
2. 관리자 후보 계정 가입 신청
3. MongoDB에서 계정 권한 수정

예시: 특정 계정을 실장급 관리자로 승격

```powershell
docker exec -it mongo mongosh devicerental --eval "db.users.updateOne({ id: '<아이디>' }, { $set: { isPending: false, isAdmin: true, position: '실장', roleLevel: 2 } })"
```

예시: `yya007`을 연구원 직급으로 유지하되 관리자 권한만 부여

```powershell
docker exec -it mongo mongosh devicerental --eval "db.users.updateOne({ id: 'yya007' }, { $set: { isPending: false, isAdmin: true, position: '연구원', roleLevel: 2 } })"
```

권한 기준:

| roleLevel | 의미 |
|---|---|
| 1 | 센터장 |
| 2 | 실장급 |
| 3 | 팀장급 |
| 4 | 파트장 |
| 5 | 연구원 |

현재 프론트/백엔드는 `roleLevel <= 3`이면 승인 대기 접근 권한을 가진다.

### 10.2 DB에서 사용자 확인

```powershell
docker exec -it mongo mongosh devicerental --eval "db.users.find({}, { id: 1, name: 1, affiliation: 1, position: 1, roleLevel: 1, isAdmin: 1, isPending: 1, authProvider: 1, email: 1 }).sort({ name: 1 }).toArray()"
```

---

## 11. Microsoft SSO 설정

Microsoft 365 계정 연동은 Microsoft Entra ID 앱 등록 기반 OAuth/OIDC 방식이다.

필요한 값:

- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`

신규 서버의 redirect URI 예시:

```text
http://<서버IP>:4000/api/auth/microsoft/callback
```

Entra ID 쪽에서 위 Redirect URI가 등록되어 있어야 한다.  
`.env`에도 동일하게 입력한다.

```env
MICROSOFT_REDIRECT_URI=http://<서버IP>:4000/api/auth/microsoft/callback
```

설정 후 컨테이너 재시작:

```powershell
docker compose up -d --build
```

확인:

```powershell
curl.exe http://localhost:4000/api/auth/microsoft/config
```

정상 기준:

- `enabled: true`면 Microsoft 로그인 버튼 활성화
- `enabled: false`면 `.env` 또는 Entra ID 앱 등록값 확인

---

## 12. 실제 디바이스 데이터 임포트

실제 시운전 데이터 기준 파일:

```text
seed-data\DeviceRent_release_devices_2026-09-08.xlsx
```

기준 시트:

```text
게임덱스260325
```

주의:

- 운영 엑셀에서 `게임덱스260325` 시트를 기준으로 한다.
- 현재 저장소에는 위 기준 파일의 복사본이 `seed-data` 폴더에 포함되어 있다.
- 임포트용으로 시트명을 맞춰야 할 경우, 원본 파일을 직접 훼손하지 말고 복사본에서 시트 복제/수정 후 업로드한다.
- 기기 목록을 실제 릴리즈 데이터로 교체할 경우 `엑셀 강제 초기화`를 사용한다.
- 대여 이력까지 완전 초기화하려면 13장 절차를 별도로 진행한다.

UI 임포트 절차:

1. 관리자 계정으로 로그인
2. 포털에서 `DeviceRent` 이동
3. 상단 `관리자` 또는 `디바이스 관리` 이동
4. `엑셀 강제 초기화` 선택
5. 실제 운영 엑셀 파일 업로드
6. 완료 후 대여하기/디바이스 관리 목록 수량 확인

스크립트 임포트 절차:

```powershell
.\scripts\import-release-devices.ps1 -ApiBaseUrl "http://localhost:4000" -AdminId "<관리자아이디>" -Password "<비밀번호>" -ForceInit
```

다른 PC에서 서버 IP 기준으로 넣을 때:

```powershell
.\scripts\import-release-devices.ps1 -ApiBaseUrl "http://<서버IP>:4000" -AdminId "<관리자아이디>" -Password "<비밀번호>" -ForceInit
```

정상 기준:

- 디바이스 총 수량이 실제 엑셀 기준과 일치
- `활성`, `수리 필요`, `비활성/폐기` 상태가 엑셀의 기기 상태 기준으로 반영
- 상세정보 모달에 RAM, 해상도, 인치, Bluetooth, UDID 등 정보 표시

---

## 13. 시운전 전 DB 완전 초기화 절차

이 절차는 기존 테스트 데이터, 대여 이력, 제보 이력 등을 삭제한다.  
반드시 감독자 승인 후 실행한다.

### 13.1 백업

기존 DB 상태를 보존해야 하면 먼저 MongoDB dump를 뜬다.

```powershell
docker exec mongo mongodump --db devicerental --out /tmp/devicerental-backup
docker cp mongo:/tmp/devicerental-backup ./devicerental-backup
```

### 13.2 기기/이력/제보 데이터 삭제

사용자 계정은 보존하고, 시운전 데이터만 비우는 방식이다.

```powershell
docker exec -it mongo mongosh devicerental --eval "db.devices.deleteMany({}); db.rentalhistories.deleteMany({}); db.devicechangerequests.deleteMany({}); db.devicestatushistories.deleteMany({});"
```

삭제 후 확인:

```powershell
docker exec -it mongo mongosh devicerental --eval "({ devices: db.devices.countDocuments(), rentalhistories: db.rentalhistories.countDocuments(), devicechangerequests: db.devicechangerequests.countDocuments(), devicestatushistories: db.devicestatushistories.countDocuments(), users: db.users.countDocuments() })"
```

정상 기준:

- `devices: 0`
- `rentalhistories: 0`
- `devicechangerequests: 0`
- `devicestatushistories: 0`
- `users`는 유지

### 13.3 모든 DB 데이터 삭제

사용자까지 포함해서 완전히 백지 상태로 만들 때만 사용한다.

```powershell
docker compose down -v
docker compose up -d --build
```

주의:

- `down -v`는 MongoDB 볼륨을 삭제한다.
- 사용자 계정, 디바이스, 대여 이력, 승인 이력 모두 사라진다.
- 실행 후 초기 관리자 계정을 다시 만들어야 한다.

---

## 14. 시운전 체크리스트

### 14.1 로그인/포털

- 로컬 계정 로그인 가능
- Microsoft SSO 사용 시 Microsoft 365 계정 로그인 가능
- 로그인 성공 후 `/portal` 표시
- `DeviceRent` 카드 클릭 시 `/devices` 이동
- `사용자 관리`은 관리자 권한일 때만 접근 가능

### 14.2 대여하기

- `전체`은 비활성/폐기 제외 전체 기기 표시
- `대여 가능`은 즉시 빌릴 수 있는 기기만 표시
- `대여중`은 현재 대여 중인 기기 표시
- `내 대여`은 본인이 빌린 기기만 표시
- 검색 범위별 검색 가능:
  - 시리얼
  - 기기명
  - 기기 유형
  - OS 버전
  - RAM
  - 해상도
  - 인치
  - Bluetooth

### 14.3 대여 유형

- 일반: 승인 없이 즉시 대여
- 재택: 승인 없이 즉시 대여, 대여 유형은 `재택`으로 기록
- 외부: 사유 필수, 승인 전에는 대여 확정되지 않음
- 외부 승인대기 상태의 기기는 다른 사용자가 빌릴 수 없음

### 14.4 승인 대기

- 승인 대기 페이지에서 두 갈래 확인:
  - 외부대여 승인
  - 디바이스 제보
- 팀장급 이상 또는 `roleLevel <= 3` 계정만 접근 가능
- 외부대여 승인 시 실제 대여 상태로 전환
- 외부대여 반려 시 잠금 해제
- 디바이스 제보 승인 시 기기 상세정보 또는 상태 갱신

### 14.5 반납/제보

- 본인이 빌린 기기는 반납 버튼만 표시
- 타인이 빌린 기기는 대여 유형 배지 표시
- 반납 시 대여 이력 생성
- 반납과 함께 OS 변경 또는 수리 필요 제보 가능
- 제보 승인대기 중인 기기는 대여 불가

### 14.6 관리자 기능

- 디바이스 관리에서 활성/수리 필요/비활성 상태별 필터 가능
- 비활성/폐기 기기는 일반 대여 화면에서 제외
- 대여 중인 기기 삭제 불가
- 기기별 대여 히스토리 확인 가능
- 대여 히스토리는 최신 대여일 기준 내림차순 표시
- 대여일/반납일 기준 정렬 가능

---

## 15. 장애 대응

### 15.1 Docker Desktop이 시작되지 않음

확인:

```powershell
docker version
wsl --shutdown
```

Docker Desktop 오류 예:

```text
Virtualization support not detected
```

대응:

- BIOS/UEFI에서 Virtualization 활성화
- Windows 기능에서 WSL2 확인
- Docker Desktop 재실행

Docker Model Runner 또는 socket 오류 예:

```text
starting services: initializing Inference manager
listener: The filename, directory name, or volume label syntax is incorrect
```

대응:

1. Docker Desktop 완전 종료
2. 관리자 PowerShell에서 Docker 관련 프로세스 종료
3. `wsl --shutdown`
4. Docker Desktop Settings에서 Docker Model Runner 비활성화
5. Docker Desktop 재시작

### 15.2 접속은 되는데 로그인 후 API 오류

확인:

```powershell
docker compose logs --tail=100 backend
```

점검:

- `.env`의 `JWT_SECRET` 존재 여부
- `.env`의 `ALLOWED_ORIGINS`에 `http://<서버IP>:3000` 포함 여부
- 브라우저 접속 주소와 API 주소가 같은 서버 IP를 기준으로 잡히는지

### 15.3 같은 사내망에서 접속 불가

확인:

```powershell
docker compose ps
Test-NetConnection <서버IP> -Port 3000
Test-NetConnection <서버IP> -Port 4000
```

점검:

- 서버 IP가 유선 LAN IP가 맞는지
- Windows 방화벽 3000/4000 인바운드 허용 여부
- Docker 포트 매핑이 `0.0.0.0:3000->3000/tcp`, `0.0.0.0:4000->4000/tcp`인지

### 15.4 화면이 예전 상태로 보임

대응:

```powershell
docker compose up -d --build frontend backend
```

브라우저에서 강력 새로고침:

```text
Ctrl + F5
```

---

## 16. 운영 명령 모음

서비스 시작/갱신:

```powershell
docker compose up -d --build
```

서비스 상태:

```powershell
docker compose ps
```

로그:

```powershell
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose logs --tail=100 mongo
```

서비스 중지:

```powershell
docker compose down
```

DB 볼륨까지 삭제:

```powershell
docker compose down -v
```

주의: `down -v`는 DB 전체 삭제다. 승인 없이 실행하지 않는다.

---

## 17. 최종 정상 판정 기준

신규 서버 시운전 준비 완료 기준:

- Git 최신 소스 반영 완료
- `.env` 신규 서버 IP 기준 설정 완료
- Docker Desktop 정상 실행
- `docker compose ps`에서 frontend/backend/mongo Up
- 서버 PC에서 `http://localhost:3000` 접속 가능
- 사내망 PC에서 `http://<서버IP>:3000` 접속 가능
- 로그인 후 포털 페이지 표시
- DeviceRent 이동 가능
- 실제 엑셀 기반 디바이스 목록 반영
- 일반/재택/외부 대여 플로우 확인
- 외부대여 승인대기 및 디바이스 제보 승인대기 확인
- 관리자 계정 권한 정상

---

## 18. 감독자 확인 포인트

에이전트 작업 완료 후 감독자는 아래만 확인하면 된다.

1. 접속 주소가 맞는가?
   - `http://<서버IP>:3000`
2. 로그인 후 포털이 먼저 뜨는가?
3. DeviceRent 선택 시 대여하기 페이지로 이동하는가?
4. 디바이스 목록 수량이 실제 엑셀 기준과 맞는가?
5. 비활성/폐기 기기가 대여하기 `전체`에 보이지 않는가?
6. 외부대여가 승인 없이는 대여 완료 처리되지 않는가?
7. 관리자 권한 계정으로 승인 대기/사용자 관리/디바이스 관리 접근이 가능한가?
8. MongoDB 27017이 외부에 노출되지 않았는가?

위 항목이 모두 정상이면 신규 서버 PC 시운전 환경 구성 완료로 본다.
