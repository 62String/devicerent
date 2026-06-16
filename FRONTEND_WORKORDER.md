# 프론트엔드 작업 지시서 — 대시보드 + 장기대여 승인 워크플로우

> 백엔드는 완료/검증됨. 이 문서대로 **프론트만** 구현하면 된다.
> 기존 디자인 시스템(노트 스타일)을 **그대로 재사용**할 것. 새 색/스타일을 만들지 말 것.

---

## 0. 반드시 지킬 규칙

- **은어 금지**: UI 문구에 "존버" 같은 은어 절대 금지. 회수 대상은 **"장기 미반납 / 회수 필요"**, 미승인은 **"미승인"**.
- **디자인 토큰 재사용**: 색/간격/컴포넌트는 `frontend/src/index.css`에 정의된 CSS 변수와 클래스를 쓴다. 하드코딩 색상 금지(다크모드 깨짐).
  - 자주 쓰는 클래스: `.page-wrap`, `.page-title`, `.page-sub`, `.card`, `.btn`(`.btn-primary`/`.btn-outline`/`.btn-ink`/`.btn-danger`/`.btn-sm`), `.badge`(`.badge-ok`/`.badge-warn`/`.badge-danger`/`.badge-neutral`), `.table-note`, `.stat-card`(`.stat-card-label`/`.stat-card-value`), `.modal-overlay`/`.modal-box`/`.modal-head`/`.modal-title`/`.modal-body`/`.modal-foot`/`.modal-note`, `.input`, `.field-label`, `.alert`(`.alert-error`/`.alert-success`), `.pg-btn`, `.td-mono`, `.cell-main`, `.cell-sub`, `.td-sub`, `.td-hint`, `.remark-preview`, `.icon-btn`, `.nav-link`/`.nav-link-active`.
  - 색 변수: `--ink/--sub/--hint/--line/--lsoft/--surface/--paper/--accent/--ok/--okt/--okb/--wn/--wnt/--wnb/--dg/--dgt/--dgb`.
- **아이콘**: `frontend/src/components/Icons.jsx`의 인라인 SVG 컴포넌트 사용(외부 아이콘 라이브러리 추가 금지). 없으면 같은 패턴(`Svg` 래퍼)으로 추가.
- **다크모드**: 토큰만 쓰면 자동 대응됨. 별도 처리 불필요.
- **공통 유틸**: API 베이스 URL은 `import { getApiUrl } from '<상대경로>/utils/api'`, 인증은 `import { useAuth } from '<상대경로>/utils/AuthContext'`(→ `user`), 토큰은 `localStorage.getItem('token')`. 헤더 `Authorization: Bearer ${token}`.
- 한국어 라벨, 문장형이 아닌 명사형 제목. 숫자는 정수.

---

## 1. 권한 게이팅 기준

`/api/me` 응답: `{ id, name, affiliation, position, isPending, isAdmin }` (※ roleLevel 없음).

- **관리자 전용**(대시보드): `user.isAdmin === true` (파트장 이상).
- **팀장 이상 전용**(승인 대기/승인 처리): `['팀장','실장','센터장'].includes(user.position)`.
  - 헬퍼 하나 만들기 권장: `const isTeamLeadOrAbove = (u) => ['팀장','실장','센터장'].includes(u?.position)`.
- 백엔드도 동일하게 막혀 있으니 프론트 게이팅은 메뉴/라우트 노출용. 권한 없으면 `/devices`로 리다이렉트.

---

## 2. 백엔드 API 계약 (이대로 호출)

### 2-1. 대여(기존, rentalType만 추가됨)
`POST /api/devices/rent-device`  body: `{ deviceId, remark, rentalType }`
- `rentalType`: `'normal'`(기본) | `'longterm'`. 장기대여로 보내면 서버가 자동으로 승인 대기(pending) 처리.

### 2-2. 대시보드 (관리자 전용)
`GET /api/devices/dashboard` → 200
```json
{
  "counts": { "total": 48, "available": 27, "rented": 18,
              "longtermApproved": 2, "pendingApproval": 2,
              "maintenance": 4, "overdue": 3 },
  "osDistribution": { "Android": 28, "iOS": 20 },
  "statusDistribution": { "active": 44, "repair": 3, "inactive": 1 },
  "rentedDevices": [
    { "serialNumber": "SN017", "modelName": "Galaxy Z Fold6",
      "osName": "Android", "osVersion": "14",
      "renterName": "김철수", "affiliation": "QA 1팀",
      "rentedAt": "2026-06-07T01:12:00.000Z",
      "rentalType": "normal", "longTermStatus": "none",
      "approvedBy": "", "elapsedHours": 216, "overdue": true }
  ],
  "recentActivity": [
    { "action": "rent", "serialNumber": "SN021", "userName": "박민수",
      "affiliation": "QA 1팀", "timestamp": "2026-06-16T00:42:00.000Z" }
  ],
  "overdueThresholdHours": 72
}
```
- `rentedDevices`는 경과시간 내림차순 정렬됨.
- 프론트 분할 로직:
  - **회수 필요 위젯**: `rentedDevices.filter(d => d.overdue)` (일반 72h+ AND 미승인 장기 72h+ 포함).
    - 유형 배지: `d.rentalType==='longterm' && d.longTermStatus==='pending'` → `미승인`(badge-danger), 그 외 → `일반`(badge-neutral).
  - **장기대여 현황(승인)**: `rentedDevices.filter(d => d.rentalType==='longterm' && d.longTermStatus==='approved')` → `approvedBy` 표시.
  - **승인 대기 배너 수**: `counts.pendingApproval`.

### 2-3. 장기대여 승인 (팀장 이상 전용)
- `GET /api/devices/longterm/pending` → 200
```json
[ { "serialNumber":"SN051","modelName":"Galaxy Tab S9","osName":"Android","osVersion":"14",
    "renterName":"정승아","affiliation":"개발 1팀","remark":"6/30까지 ○○ 업데이트 대응",
    "rentedAt":"2026-06-16T00:40:00.000Z","elapsedHours":1,"overdue":false } ]
```
- `POST /api/devices/longterm/approve` body `{ serialNumber }` → `{ message, device }`
- `POST /api/devices/longterm/reject`  body `{ serialNumber }` → `{ message, device }` (일반대여로 환원)
- 권한 부족 시 403 `{ message: "권한이 부족합니다. 팀장 이상만 가능합니다." }`.

---

## 3. 작업 항목

### T1. 대여 모달에 "대여 유형" 추가 — `src/Devices.jsx`
- 대여 확인 모달에 **세그먼트 토글**: `일반 대여` / `장기대여 · 출장` (기본 = 일반).
- 상태값 `rentalType`(`'normal'|'longterm'`) 추가 → `rent-device` 호출 시 body에 포함.
- 장기대여 선택 시:
  - 안내문(노란 톤, `--wnb/--wnt`): **"팀장 승인 후 정식 장기대여로 확정됩니다. 반납 예정일과 사유를 특이사항에 적어주세요."** (※ "집계 제외" 같은 내부 로직 절대 노출 금지)
  - 특이사항 placeholder 예시 전환: 일반 → `예) 액정 우측 하단 미세 스크래치` / 장기 → `예) 6/30까지 ○○프로젝트 업데이트 대응 장기 대여`
  - 제출 버튼 라벨 `대여하기` → `승인 요청`
- 시안: 이 대화의 "devicerent_rent_modal_dynamic_placeholder" / "..._approval_note".

### T2. 대여 페이지 빠른 수정 — `src/Devices.jsx`
- **"초기화" 버튼 → "검색 초기화"** 로 라벨 변경.
- **기본 표시 = 대여 가능만**: 첫 진입 시 `상태 active && !rentedBy`인 디바이스만 표시. 토글로 "모든 디바이스 보기" ↔ "대여 가능만". 기존 "내 디바이스" 버튼 유지.

### T3. 대시보드 페이지 — `src/Dashboard.jsx` (신규)
- 라우트 `/dashboard`, **관리자 전용**. `GET /api/devices/dashboard` 호출.
- 구성(시안 "devicerent_dashboard_clean_labels" 그대로):
  1. **KPI 5장**(`.stat-card`): 전체 보유 / 대여 가능 / 대여중 / 장기대여(승인)=`longtermApproved` / **장기 미반납**=`overdue`(빨강).
  2. **승인 대기 배너**(`pendingApproval>0`일 때, 노란 톤): "장기대여 승인 대기 N건 — 팀장 이상 검토 필요" + "승인 대기 보기 →"(→ `/longterm/approvals`). 팀장 미만에겐 안내문만(이동 버튼 숨김) 또는 배너 자체를 팀장+에게만.
  3. **장기 미반납 · 회수 필요 위젯**(빨강 테두리 카드, 좌측): `overdue` 필터. 컬럼: 시리얼 / 모델·대여자 / 유형배지(일반·미승인) / 경과. 행 배경 `--dgb`.
  4. **OS·상태 분포**(우측): OS 막대(`osDistribution`), 상태 칩(`statusDistribution` 활성/수리중/비활성).
  5. **최근 활동**(우측): `recentActivity` 점+텍스트+시각.
  6. **장기대여 현황(승인 완료)**(하단, 차분한 톤): approved 필터, 컬럼 시리얼/모델·대여자/사유(remark 없으면 생략)/승인자(`approvedBy`)/경과. 초록 "승인됨" 배지.
- 경과시간 표기 헬퍼: `elapsedHours`를 "N일/N시간"으로(24 이상이면 일, 아니면 시간).

### T4. 장기대여 승인 대기 페이지 — `src/admin/pages/LongTermApproval.jsx` (신규)
- 라우트 `/longterm/approvals`, **팀장 이상 전용**. `GET /longterm/pending`.
- 테이블(시안 "devicerent_approval_queue_clean"): 시리얼 / 디바이스·신청자 / 사유(특이사항=remark) / 신청일시(rentedAt) / 경과 / [승인][거절].
  - `overdue===true` 행은 `--dgb` 배경 + 사유 옆 `3일 초과 · 회수 대상`(badge-danger).
  - 승인/거절 → 해당 POST 호출 후 목록 새로고침 + 토스트/alert. 빈 목록이면 "승인 대기 중인 장기대여가 없습니다.".
- 상단 안내: "팀장 이상이 검토 후 승인합니다 · 미승인 상태로 3일을 넘기면 장기 미반납 목록에도 표시됩니다."

### T5. 라우팅 + 접근 제어 — `src/App.jsx`
- `/dashboard` → `ProtectedRoute isAdmin`(기존 패턴).
- `/longterm/approvals` → 팀장+ 게이트. 기존 `ProtectedRoute`에 `requireTeamLead`(position 기반) 옵션을 추가하거나, 별도 가드 컴포넌트 작성. 권한 없으면 `/devices`로 `<Navigate replace>`.

### T6. 네비게이션 — `src/admin/components/Navbar.jsx`
- `user.isAdmin`이면 **"대시보드"**(`/dashboard`) 링크 추가.
- 팀장+이면 **"승인 대기"**(`/longterm/approvals`) 링크 추가. 가능하면 `counts.pendingApproval` 배지(없으면 생략 가능).
- 기존 `nav-link`/`nav-link-active`(NavLink) 패턴 그대로.

---

## 4. 완료 기준 (체크리스트)

- [ ] 비관리자(연구원)는 네비에 대시보드/승인 대기 안 보이고, URL 직접 접근 시 `/devices`로 튕김.
- [ ] 팀장 미만(파트장 포함)은 승인 대기 접근 불가(팀장/실장/센터장만).
- [ ] 대여 모달 일반/장기 토글 동작, 장기 선택 시 `rentalType:'longterm'` 전송 확인, placeholder·버튼 라벨 전환.
- [ ] 대시보드 KPI 숫자가 API `counts`와 일치, 회수 필요 위젯에 일반·미승인만(승인 장기 제외), 장기대여 현황에 승인 건만.
- [ ] 승인 대기에서 승인→목록에서 사라지고 대시보드 장기대여 현황(승인)에 등장 / 거절→일반대여로 환원.
- [ ] 라이트·다크 모드 모두 정상, UI에 은어("존버") 없음.
- [ ] 대여 페이지 첫 진입 "대여 가능만", "검색 초기화" 라벨.

---

## 5. 참고

- 시안 원본은 작업 의뢰 대화의 Imagine 위젯들(타이틀): `devicerent_dashboard_clean_labels`, `devicerent_approval_queue_clean`, `devicerent_rent_modal_dynamic_placeholder`(+`_approval_note`).
- 기존 페이지(예: `DeviceStatus.jsx`, `UsersPage.jsx`)가 동일 디자인 시스템으로 짜여 있으니 **구조/패턴을 그대로 모방**하면 된다(헤더 `page-wrap`+`page-title`, `card`+`table-note`, 페이지네이션 `pg-btn` 등).
