# App Store 등록 정보 — 쿠폰북 (iOS 2.0.0, build 1)

App Store Connect에 그대로 붙여 넣을 수 있는 문안입니다. 한국어(기본)와 영어(en-US)를 모두
제공하며, 글자 수는 ASC 제한(이름·부제 30 / 프로모션 170 / 설명 4,000 / 키워드 100)을 지켰습니다.
소스 진실: `static/js/config.js`(광고 ID·URL·버전), `ios/App/App/Info.plist`(권한 문구·GAD 앱 ID),
`ios/App/App.xcodeproj/project.pbxproj`(MARKETING_VERSION 2.0.0 / CURRENT_PROJECT_VERSION 1).

---

## 1. 앱 이름 후보 (≤30자, 전 세계 유일해야 하므로 순서대로 시도)

| 순위 | 한국어 (ko) | 영어 (en-US) | 글자 수 |
| --- | --- | --- | --- |
| 1 | `쿠폰북: 쿠폰·도장·이용권 지갑` | `Coupon Book: Stamps & Passes` | 17 / 28 |
| 2 | `쿠폰북 – 도장판·회수권 지갑` | `Coupon Book – Loyalty Wallet` | 16 / 28 |
| 3 | `쿠폰북: 내 쿠폰 지갑` | `CouponBook – My Coupon Wallet` | 12 / 29 |

번들 ID `com.lightonpluslab.couponbook`, SKU 제안 `couponbook-ios`, 기본 언어 **한국어**.

## 2. 부제 (≤30자)

- ko: `도장판·회수권·금액권을 내 폰에만` (18)
- en: `Stamp cards & passes on-device` (30)

## 3. 프로모션 텍스트 (≤170자, 심사 없이 수정 가능)

- ko (88):
  `카페 도장판, 마사지 회수권, 금액권을 한곳에. 회원가입 없이, 모든 데이터는 내 아이폰에만 저장돼요. 만료 전 D-7·D-3·D-1 알림과 지도·길찾기까지.`
- en (157):
  `Stamp cards, session passes and prepaid balances in one place. No account — everything stays on your iPhone. Expiry reminders at D-7/3/1, map and directions.`

## 4. 설명 (≤4,000자)

### ko

```
지갑 속에서 구겨지고, 사라지고, 만료돼 버리는 쿠폰들.
쿠폰북은 카페 도장판, 찜질방·마사지 회수권, 병원·미용실 쿠폰, 금액권(선불권)까지
직접 등록해 한곳에서 관리하는 개인 쿠폰 지갑입니다.

■ 이런 분께 필요해요
• 카페 도장 10개 중 몇 개 모았는지 매번 헷갈리는 분
• 마사지·필라테스·세차 회수권이 몇 번 남았는지 모르는 분
• 금액권(선불권) 잔액을 머릿속으로 계산하고 있는 분
• 쿠폰 만료일을 지나서 아까워한 적 있는 분

■ 주요 기능
• 세 가지 이용권 — 도장판(적립), 횟수권(차감), 금액권(잔액)을 모두 지원
• 30초 등록 — 템플릿과 빠른 선택 칩으로 이름과 종류만 있으면 바로 등록
• 원터치 사용 — 카드에서 바로 도장 적립·차감, 되돌리기 한 번으로 취소
• 도장판 완성 축하 — 마지막 칸을 채우면 보상 안내와 함께 새 도장판으로 이어가기
• 만료 임박 알림 — D-7 · D-3 · D-1 오전 9시에 기기에서 직접 알림 (앱을 꺼 둬도 도착)
• 지도와 길찾기 — 저장한 가게를 지도에서 확인하고 Apple 지도로 바로 길찾기
• 가게 근처 알림 — 원하면 저장한 가게 근처에 머물 때 "여기 쿠폰 있어요"
• 쿠폰·멤버십 코드 — 바코드·QR로 크게 보여 주고 복사까지
• 사용 내역 — 언제 어디서 썼는지 날짜별로 정리
• 백업과 복원 — 파일 하나로 내보내고, 새 아이폰에서 그대로 복원

■ 개인정보 걱정 없음
• 회원가입·로그인이 없습니다
• 입력한 모든 데이터는 서버가 아니라 내 아이폰에만 저장됩니다
• 앱 안에 자동 보관본이 함께 기록되어 저장소가 비워져도 스스로 복구합니다
• 위치·알림 권한은 해당 기능을 켤 때만 요청하고, 위치는 기기 밖으로 나가지 않습니다

■ 가볍고 빠름
• 오프라인에서도 동작 (지도 타일만 인터넷 필요)
• 계정, 광고 추적 없이도 모든 기능을 그대로 사용

메모장과 사진첩에 흩어져 있던 쿠폰, 이제 한곳에서 관리하세요.

문의: support@lightonpluslab.com
개인정보처리방침: https://coupon.lightonpluslab.com/privacy.html
```

### en-US

```
Coupons get crumpled, lost and expire in the bottom of a wallet.
Coupon Book is a personal coupon wallet: register café stamp cards, massage and sauna session
passes, clinic and salon coupons, and prepaid balances yourself, and keep them all in one place.

WHO IT IS FOR
• You never remember how many of the 10 café stamps you have collected
• You are not sure how many massage, pilates or car-wash sessions are left
• You keep a prepaid balance in your head
• You have let a coupon expire and regretted it

FEATURES
• Three pass types — stamp cards (collect), session passes (deduct) and prepaid amounts (balance)
• 30-second setup — templates and quick-pick chips; a name and a type are all you need
• One-tap use — stamp or deduct right on the card, undo with one tap
• Completed stamp card — a small celebration, then start the next card in one tap
• Expiry reminders — at 9 AM on D-7, D-3 and D-1, scheduled on the device (works with the app closed)
• Map and directions — see your saved shops on a map and open Apple Maps for directions
• Nearby alerts (optional) — get a nudge when you linger near a saved shop
• Coupon and membership codes — shown large as barcode and QR, with copy
• History — every stamp and use, grouped by day
• Backup and restore — export one file, restore it on a new iPhone

PRIVACY
• No sign-up, no login
• Everything you enter stays on your iPhone — there is no server
• An automatic in-app copy restores your data if the storage is ever cleared
• Location and notification permissions are asked only when you turn those features on; location never leaves the device

LIGHT AND FAST
• Works offline (only map tiles need the internet)
• Every feature works without an account or ad tracking

Coupons scattered across notes and photos — now in one place.

Support: support@lightonpluslab.com
Privacy policy: https://coupon.lightonpluslab.com/privacy.html
```

## 5. 키워드 (≤100자, 쉼표 구분 — 이름·부제에 있는 단어는 뺌)

- ko (54): `쿠폰,도장판,스탬프,회수권,이용권,금액권,선불권,만료알림,쿠폰지갑,멤버십,적립,포인트,카페,마사지`
- en (99): `coupon,stamp card,loyalty,punch card,pass,prepaid,voucher,wallet,expiry,reminder,membership,rewards`

## 6. URL

| 항목 | 값 |
| --- | --- |
| 지원 URL | https://lightonpluslab.com |
| 마케팅 URL | https://coupon.lightonpluslab.com |
| 개인정보처리방침 URL | https://coupon.lightonpluslab.com/privacy.html (ko + en 한 페이지, `#en` 앵커) |

`static/privacy.html`이 이 저장소에서 배포됩니다(GitHub Pages). 오케스트레이터가 `main`에 머지·배포하면
같은 URL로 갱신됩니다. 심사 제출 전에 실제 URL에서 2026-09-13 판이 보이는지 확인할 것.

## 7. 카테고리 / 가격 / 배포

- 기본 카테고리 **Lifestyle(라이프스타일)**, 보조 카테고리 **Finance(금융)**
- 가격 **무료**, 인앱 구매 없음, 모든 국가/지역
- 기기: iPhone 전용(TARGETED_DEVICE_FAMILY = 1), 세로 방향 고정, iOS 15.0+
- 콘텐츠 권리: 제3자 콘텐츠 없음 (지도 타일은 OpenStreetMap 저작자 표시를 앱 안에 표시)
- 수출 규정: `ITSAppUsesNonExemptEncryption = false` → "암호화 사용 안 함"(HTTPS만 사용)

## 8. 연령 등급 설문 (→ 4+)

| 항목 | 답 |
| --- | --- |
| 만화/판타지/사실적 폭력, 성적 콘텐츠·노출, 욕설·저속한 유머, 공포/두려움 | 없음 |
| 술·담배·약물 관련 콘텐츠 | 없음 |
| 도박 시뮬레이션, 실제 도박, 경품/콘테스트 | 없음 |
| 의학/치료 정보 | 없음 |
| 성인/외설적 주제 | 없음 |
| 무제한 웹 액세스 | 아니요 (개인정보처리방침·홈페이지 링크만 인앱 브라우저로 염) |
| 사용자 생성 콘텐츠 / 메시지·채팅 | 없음 (공유 기능 없음) |
| 부모 통제 / 루트박스 | 없음 |
| Made for Kids | 아니요 |

## 9. App Privacy (앱 개인정보 보호) — 두 가지 변형

### 변형 A — 광고 꺼짐 (지금 만든 build 1 그대로: `config.js`의 `ADS.ios.bannerId = ''`)

- **데이터 수집 안 함 (Data Not Collected)** — 모든 항목 "아니요".
- 근거: 계정 없음, 서버 없음, 분석 SDK 없음. 위치는 기기 안에서만 사용(전송 없음). AdMob SDK는
  링크만 되어 있고 초기화되지 않으므로 어떤 데이터도 흐르지 않음. ATT 프롬프트도 뜨지 않음.
- 개인정보처리방침에 "무료 버전에는 광고가 표시될 수 있음"이 이미 들어 있어 변형 B로 바꿀 때
  방침을 고칠 필요는 없음.

### 변형 B — AdMob 배너 켜짐 (실 배너 ID 입력 후 재빌드)

| 데이터 유형 | 수집 | 용도 | 사용자와 연결 | 추적에 사용 |
| --- | --- | --- | --- | --- |
| 식별자 › 기기 ID (광고 식별자 IDFA — ATT 허용 시에만) | 예 | 제3자 광고 | 아니요 | **예** |
| 사용 데이터 › 광고 데이터 | 예 | 제3자 광고 | 아니요 | 예 |
| 사용 데이터 › 제품 상호작용 (광고 노출·클릭) | 예 | 제3자 광고, 앱 기능 | 아니요 | 아니요 |
| 위치 › 대략적 위치 (IP 기반, Google이 광고 게재에 사용) | 예 | 제3자 광고 | 아니요 | 아니요 |
| 진단 › 크래시/성능 데이터 (Google Mobile Ads SDK 자체 수집) | 예 | 앱 기능 | 아니요 | 아니요 |
| 연락처 정보, 건강, 재무, 사용자 콘텐츠, 검색 기록, 구매 | 아니요 | — | — | — |

- "이 앱은 추적을 사용하나요?" → **예**(ATT 사용). Info.plist에 `NSUserTrackingUsageDescription`
  (ko/en 문장) 있음. 사용자가 "앱에 추적 금지 요청"을 고르면 `npa=1`(비맞춤 광고)로 요청함.
- 정밀 위치(Precise Location)는 광고에 넘기지 않음 — 앱은 AdMob에 위치를 전달하지 않음.

## 10. 심사 메모 (App Review Notes — 영어로 제출)

```
Coupon Book is a fully offline, on-device coupon wallet. There is no account, sign-in or server;
no demo credentials are needed.

How to test quickly
1. First launch shows a 3-step intro. On step 2 tap "샘플로 둘러보기" (Browse with samples) to
   load three sample shops (a café stamp card, a sauna session pass, a prepaid balance).
2. Home → tap any card's "도장"/"사용" button to stamp or deduct; the toast offers one-tap undo.
   Filling the last stamp of the café card shows the completion screen.
3. Expiry reminders: Settings → "만료 임박 알림" switch → allow notifications. Reminders are local
   notifications scheduled for 9 AM on D-7/D-3/D-1 of each pass expiry. To see one sooner, edit a
   pass and set its expiry to tomorrow; a D-1 reminder is scheduled for tomorrow 9 AM. Nothing is
   sent to any server.
4. Map: the "지도" tab asks for When-In-Use location only when opened; it plots shops that have a
   saved location and opens Apple Maps for directions. It works without permission (shop-centred).
5. Backup: Settings → "백업 파일 내보내기" writes a JSON file to the app's Documents folder
   (visible in Files) and opens the share sheet; "백업 파일에서 복원" opens the document picker.

Advertising: this build shows NO ads (the AdMob banner is disabled in config); the Google Mobile
Ads SDK is linked but never initialised, and the App Tracking Transparency prompt is not shown.
[If the AdMob banner is enabled for this build, replace with: "The free version shows a Google
AdMob banner at the bottom. App Tracking Transparency is requested once before the first ad;
declining serves non-personalized ads. All features work identically either way."]

The app is Korean-language (its audience is Korea, where stamp cards and prepaid passes are
common); the App Store listing is provided in Korean and English.
```

## 11. 새로운 기능 (릴리스 노트)

- ko:
  ```
  쿠폰북이 iPhone에 왔어요.
  • 도장판·횟수권·금액권을 한곳에서, 계정 없이 내 아이폰에만 저장
  • 만료 D-7·D-3·D-1 알림, 지도와 Apple 지도 길찾기
  • 파일로 백업·복원, 앱 안 자동 보관본으로 데이터 보호
  ```
- en:
  ```
  Coupon Book arrives on iPhone.
  • Stamp cards, session passes and prepaid balances in one place — no account, stored only on your iPhone
  • Expiry reminders at D-7/D-3/D-1, a map and Apple Maps directions
  • Backup and restore as a file, plus an automatic in-app copy that protects your data
  ```

## 12. 스크린샷

`store/ios/iphone-6.9/01..08.png`(한국어 캡션) 과 `store/ios/iphone-6.9-en/01..08.png`(영어 캡션), 모두 정확히
1320×2868 (iPhone 6.9"). 원본은 iPhone 17 Pro Max(iOS 26.0) 시뮬레이터에서 광고를 끈 릴리스 설정으로 캡처(샘플 데이터,
상태 표시줄 9:41). 생성: `python3 scripts/make-ios-store-assets.py <원본 폴더> [--lang ko|en|both]`.

| # | 화면 | ko 캡션 | en 캡션 |
| --- | --- | --- | --- |
| 01 | 홈(샘플 3개) | 도장판·횟수권·금액권을 한곳에 | Stamp cards, passes and balances |
| 02 | 목록 카드 도장 + 되돌리기 토스트 | 카드에서 바로 도장 쾅 | Stamp right on the card |
| 03 | 도장판 완성 모달 | 도장판을 다 채우면 보상 안내 | Fill the card, claim the reward |
| 04 | 등록 폼(빠른 시작 칩) | 30초면 등록 끝 | Set up a pass in 30 seconds |
| 05 | 횟수권 상세 | 남은 횟수와 만료일을 한눈에 | Sessions and expiry at a glance |
| 06 | 온보딩 3단계(알림 켜짐) | 만료 D-7·D-3·D-1 알림 | Reminders at D-7, D-3 and D-1 |
| 07 | 지도(안양 기준) | 저장한 가게를 지도에서 | Your shops on a map |
| 08 | 온보딩 1단계(환영) | 계정 없이, 내 아이폰에만 | No account. Stays on your iPhone. |

iPad 스크린샷 없음 (iPhone 전용 앱). ASC 에는 ko 세트를 기본 언어(한국어)에, en 세트를 영어(미국)에 올린다.

## 13. 오케스트레이터가 콘솔에서 해야 할 것

1. **App Store Connect**: 앱 레코드 생성(번들 ID `com.lightonpluslab.couponbook`, 이름 후보 1→3 순서로
   시도), 위 텍스트·URL·카테고리·연령 등급·App Privacy(변형 A) 입력, 스크린샷 업로드, IPA 업로드
   (`~/Projects/_releases/쿠폰북/coupon-book-2.0.0-ios-build1.ipa`), 수출 규정 "아니요".
2. **개인정보처리방침 배포**: `static/privacy.html`을 `main`에 머지 → GitHub Pages
   (coupon.lightonpluslab.com/privacy.html).
3. **AdMob(광고를 켤 때만)** — 콘솔에서 iOS 앱 "쿠폰북 iOS"(앱 ID `ca-app-pub-7180935400084577~3984818286`)에
   **배너 광고 단위**를 만든 뒤:
   - `static/js/config.js` → `ADS.ios.bannerId = 'ca-app-pub-7180935400084577/<배너단위ID>'`, `useTestAds: false`
   - `ios/App/App/Info.plist` → `GADApplicationIdentifier`는 이미 `ca-app-pub-7180935400084577~3984818286`
     (테스트 ID 아님) — 그대로 둠
   - `./scripts/ios-archive.sh` 로 재아카이브(빌드 번호 `CURRENT_PROJECT_VERSION`을 2로 올릴 것),
     App Privacy를 변형 B로 바꾸고 심사 메모의 광고 문단을 교체
   - `static/app-ads.txt`는 이미 퍼블리셔 ID를 담고 있음 (AdMob 앱 설정의 앱 스토어 URL 등록 필요)
