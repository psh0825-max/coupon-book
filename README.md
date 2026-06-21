# Coupon Book (쿠폰북)

> **라이트온플러스랩(LightOn Plus Lab)** 제품 — 1인 스튜디오. 홈페이지: <https://lightonpluslab.com>

가지고 있는 도장판·쿠폰(찜질방, 마사지, 병원, 카페, 식당 등)을 직접 등록해 한곳에서 관리하는 **개인 쿠폰 지갑** 웹앱입니다. 서버 없이 완전 로컬(IndexedDB)에서 동작하며, 무료 + 광고 모델을 염두에 둔 구조입니다.

## 실행 방법

Windows: `Start-CouponBook.bat` 더블클릭
- 처음 실행 시 `.venv` 가상환경 생성
- `requirements.txt` 의존성 설치
- 3초 후 브라우저 자동 오픈: `http://127.0.0.1:7789`

직접 실행:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

다른 포트로 실행:

```powershell
$env:COUPON_BOOK_PORT="7790"
.\.venv\Scripts\python.exe app.py
```

## 핵심 기능

- 쿠폰 직접 등록: 이름, 카테고리, 주소·전화·만료일, 위치, 총 개수, **현재 적립 개수**, 메모, 스킨
- 홈 대시보드: 요약 통계(업체/진행률/만료 임박/완성), 다음 우선 쿠폰, **가로 스와이프 카드**(옆으로 밀어 탐색)
- 전체보기 화면: 검색 + 카테고리 필터 + 상태 탭(진행/임박/완성/만료) + 정렬(추천순 등) + 세로 목록
- 빠른 사용: 카드의 "사용" 버튼으로 즉시 도장 적립 (햅틱 + 토스트)
- 보상 연출: 쿠폰 완성 시 컨페티 + 풀스크린 보상 모달 (`prefers-reduced-motion` 존중)
- 스탬프판: 진행 중 도장 + 마지막 칸 선물 아이콘(보상 예고)
- 상세 관리: 전화, 지도, 만료일, 메모, 편집/삭제, 마지막 사용 취소, 사용 내역 타임라인
- 지도(지도 탭): 등록 업체 위치 마커 + 선택 매장 플로팅 카드 + **길찾기**(구글 지도) + 현재 위치
- 위치 기반 알림: 설정에서 켠 뒤 반경 진입 + 체류 시간 충족 시 자동 팝업
- 스킨 시스템: 카테고리별 비비드 그라데이션 5종
- **만료 임박 알림**: 쿠폰 만료가 다가오면 D-7 / D-3 / D-1 에 미리 알림
- **온보딩**: 첫 실행 시 3단계 안내(샘플 둘러보기 / 직접 추가 / 만료 알림 켜기), 건너뛰기 지원
- **PWA 설치 안내**: 설치 가능 시 안내 + iOS 홈 화면 추가 가이드
- **접근성 강화**: 시맨틱 롤(tab/complementary), aria-selected, 키보드 활성화 카드, `prefers-reduced-motion` 존중
- 광고 슬롯: 무료 버전 광고 영역(플레이스홀더). `static/js/services/ads.js`에서 AdSense ID 넣고 켜면 실제 광고
- 데이터 영속화: IndexedDB (`CouponBookDB`, 완전 로컬), JSON 백업/복원
- PWA 지원 (오프라인 캐싱, 설치형)

> 디자인: 라이트 전용 "소프트 UI" — 블루→시안 브랜드 그라데이션, 흰 카드 + 부드러운 그림자 + 큰 라운드. (다크 테마 없음)

> 아키텍처: 빌드 단계·외부 런타임 의존성 없는 **순수 바닐라 JS (ES Modules)**. `static/js`를 코어 / 데이터 / 도메인 / 서비스 / UI / 뷰 레이어로 분리.

## 기술 스택

- 프론트엔드: Vanilla JS (ES Modules) + CSS Variables
- 지도: Leaflet + OpenStreetMap (API 키 불필요)
- 백엔드: Python Flask + Waitress (정적 파일 서빙)
- 데이터: IndexedDB

## 주요 파일

레이어드 아키텍처 — 각 레이어는 자기보다 아래 레이어만 의존(core ← data ← domain ← services ← ui ← views ← app):

```
coupon-book/
├── app.py                   # Flask 서버
├── static/
│   ├── index.html           # SPA 셸(헤더/메인 섹션/하단 네비/FAB)
│   ├── css/
│   │   ├── base.css         # 디자인 토큰(라이트), 전역, 키프레임
│   │   ├── layout.css       # 헤더, 하단 네비, FAB, 반응형
│   │   ├── components.css   # 카드, 버튼, 폼, 스탬프, 팝업, 광고, 지도, 보상모달
│   │   ├── skins.css        # 카테고리별 그라데이션 스킨
│   │   └── extras.css       # 온보딩/설치안내 등 부가 스타일
│   ├── js/
│   │   ├── core/            # 프레임워크 원시 요소
│   │   │   ├── h.js         #   하이퍼스크립트 DOM 빌더
│   │   │   ├── store.js     #   상태 저장소(setState/select 구독)
│   │   │   └── router.js    #   뷰 레지스트리 + 백스택 + 크롬 동기화
│   │   ├── data/            # 영속 계층
│   │   │   ├── db.js        #   IndexedDB 원시 CRUD (CouponBookDB)
│   │   │   ├── repo.js      #   Shops/Logs/Settings 리포지토리 + 시드/초기화
│   │   │   └── skins.js     #   스킨/카테고리 데이터
│   │   ├── domain.js        # 순수 로직(남은 개수, 통계, 정렬, 상태, 우선순위)
│   │   ├── services/        # 부수효과/외부 연동
│   │   │   ├── format.js    #   날짜/숫자 포맷
│   │   │   ├── maps.js      #   Leaflet 지도/길찾기
│   │   │   ├── location.js  #   Geolocation + Haversine + 체류 알림
│   │   │   ├── reminders.js #   만료 임박 알림(D-7/3/1)
│   │   │   ├── pwa.js       #   서비스워커 등록 + 설치 프롬프트
│   │   │   ├── backup.js    #   JSON 백업/복원
│   │   │   ├── fx.js        #   햅틱 + 컨페티 마이크로인터랙션
│   │   │   └── ads.js       #   광고(AdSense Auto Ads) 연동
│   │   ├── ui/              # 프레젠테이션 컴포넌트
│   │   │   ├── components.js#   카드, 요약, 스탬프, 광고배너, 빈상태 등
│   │   │   ├── toast.js     #   토스트
│   │   │   ├── overlay.js   #   시트/확인 오버레이
│   │   │   └── reward.js    #   완성 보상 모달
│   │   ├── views/           # 라우트별 화면(home/list/detail/edit/map/history/settings/onboarding)
│   │   └── app.js           # 부트스트랩: store + router + actions 배선
│   ├── vendor/leaflet/      # Leaflet (로컬 번들)
│   ├── sw.js                # 서비스워커(프리캐시 + SWR)
│   ├── ads.txt              # AdSense 퍼블리셔 검증
│   └── manifest.json        # PWA
├── Start-CouponBook.bat     # Windows 더블클릭 실행
└── README.md
```

빌드 도구·번들러·npm 런타임 의존성이 없습니다. 브라우저가 ES Modules를 그대로 로드하며, 단위 테스트(Node)와 e2e(Playwright)만 devDependency로 사용합니다.

## 실제 광고 켜기

`static/js/services/ads.js`에서 (AdSense **Auto Ads** — 페이지 레벨, 슬롯 배선 불필요):

```js
export const AD_CONFIG = {
  enabled: true,                       // 활성화
  client: 'ca-pub-XXXXXXXXXXXXXXXX'    // AdSense 퍼블리셔 ID
};
```

1. AdSense에 사이트(`psh0825-max.github.io`) 등록 후 퍼블리셔 ID 발급
2. 위처럼 `enabled: true` + 실제 `ca-pub-…` ID 입력
3. 재배포 후 AdSense 대시보드에서 **Auto ads** 켜기
4. 사이트 루트의 `static/ads.txt` 를 같은 퍼블리셔 ID로 갱신

비활성 상태(또는 ID 미입력)에서는 중립 플레이스홀더 배너가 그대로 표시됩니다.
