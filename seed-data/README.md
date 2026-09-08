# DeviceRent 시운전용 디바이스 엑셀 데이터

이 폴더는 신규 로컬 서버 PC에서 실제 디바이스 목록을 바로 임포트하기 위한 파일을 보관한다.

## 포함 파일

| 파일 | 설명 |
|---|---|
| `DeviceRent_release_devices_2026-09-08.xlsx` | 2026-08-31 기준 운영 디바이스 목록 복사본 |

기준 원본:

```text
D:\SVN\QA_Document(E)\002_테스트기술문서(TT)\000_테스트장비\QA-E-TT-260317(모바일기기).xlsx
```

사용 기준 시트:

```text
게임덱스260325
```

확인 결과:

- `게임덱스260325` 시트 존재
- 해당 시트 데이터 행 수: 172행

## UI로 임포트

1. 새 서버에서 DeviceRent 실행
2. 관리자 계정으로 로그인
3. `DeviceRent` 이동
4. `디바이스 관리` 이동
5. `엑셀 강제 초기화` 선택
6. `seed-data\DeviceRent_release_devices_2026-09-08.xlsx` 업로드

## 스크립트로 임포트

프로젝트 루트에서 실행한다.

```powershell
.\scripts\import-release-devices.ps1 -AdminId "<관리자아이디>" -Password "<비밀번호>" -ForceInit
```

다른 서버 IP/API 주소에 넣을 때:

```powershell
.\scripts\import-release-devices.ps1 -ApiBaseUrl "http://<서버IP>:4000" -AdminId "<관리자아이디>" -Password "<비밀번호>" -ForceInit
```

주의:

- `-ForceInit`은 기존 디바이스 목록을 실제 엑셀 기준으로 교체한다.
- 기존 대여 이력까지 지우는 작업은 이 스크립트가 하지 않는다.
- 완전 백지 시운전이 필요하면 `docs/DeviceRent_New_Server_Handover_2026-09-08.md`의 DB 초기화 절차를 먼저 진행한 뒤 임포트한다.
