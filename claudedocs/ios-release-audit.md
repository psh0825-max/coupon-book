# 쿠폰북 iOS 출시 감사 — before / after (2026-09-13)

대상: `feature/ios-release` 브랜치, iOS 2.0.0 (build 1), 번들 ID `com.lightonpluslab.couponbook`.
증거: `claudedocs/audit/before-sheet.jpg`(개편 전 웹, 440×956 Playwright 캡처 17장),
`claudedocs/audit/after-sheet.jpg`(개편 후 웹), 그리고 iPhone 17 Pro Max(iOS 26.0) 시뮬레이터에서
XCUITest 드라이버로 실제 iOS 빌드를 돌린 검증 결과(§4). 스토어용 프레임 컷은 `store/ios/iphone-6.9/`.

## 1. 개편 전 상태 (what was weak)

before-sheet 기준, 상용 iOS 앱으로 내기엔 부족했던 점:

| 영역 | 문제 |
| --- | --- |
| 첫 실행 | 온보딩 2단계의 주 CTA가 "직접 추가"라 첫 행동이 모호. 빈 홈은 "이용권 추가"·"샘플 보기" 두 버튼이 같은 무게로 놓여 무엇을 먼저 할지 안내가 없음 |
| 등록 폼 | 한 화면에 이름·카테고리·종류·총 횟수·현재 사용·전화·만료일(`<input type=date>`)·위도/경도·스킨·메모·코드가 모두 노출. 위도/경도 숫자 입력이 일반 사용자에게 보임. 필수/선택 구분 없음, 인라인 검증 없음 |
| 데이터 모델 | 횟수권·금액권만 있고 **도장판(적립)** 개념이 없어 카페 도장판이 "10회권 0/10 사용"으로 표현됨. 카드의 체크 도장이 "남은 횟수"를 뜻해 직관과 반대 |
| 카드/스탬프 | 도장 원이 60px+로 커서 카드 하나가 화면을 다 차지, 진행 텍스트 11px, 보상 칸 없음 |
| 알림 | 만료 알림이 "앱을 열었을 때" 검사에 그침 — OS 예약 알림 없음. 알림 설정이 반경(m)/체류(분) 숫자 입력 폼으로 노출 |
| 설정 | 폼 스타일(입력 + "알림 설정 저장" 버튼). 복원이 브라우저 기본 `Choose File` 컨트롤. 앱 정보/문의/정책이 각주 링크 |
| 플랫폼 | `window.AndroidBridge`를 서비스/뷰에서 직접 호출. iOS 경로 없음. 서비스워커가 어디서나 등록 |
| 내구성 | IndexedDB 단일 저장. WKWebView 저장소 소거 시 데이터 전부 소실 |
| 레이아웃 | 하단 탭이 safe-area(홈 인디케이터) 미고려, 헤더가 Dynamic Island 뒤로 들어감, 호버 전용 어포던스(카드 그림자/버튼), 12px 미만 텍스트 다수, 탭 타깃 40px |
| 지도 | 타일 로드 실패(오프라인) 시 회색 빈 화면. 길찾기가 항상 구글 지도 |
| 광고 | AdSense 자리표시자 배너가 앱 셸에서도 노출(정책상 앱 안에서 AdSense 금지) |
| 오류 처리 | 모듈 로드/저장소 실패 시 빈 흰 화면(원인 표시·재시도 없음) |

## 2. 개편 후 (what changed)

### 2.1 플랫폼 추상화 — `static/js/platform.js`
하나의 API(`saveTextFile`, `pickTextFile`, `writeSnapshot/readSnapshot`, `prefGet/prefSet`,
`canNotify/requestNotifyPermission/notify`, `replaceScheduledReminders/scheduleReminder/cancelReminder`,
`hasLocationPermission/getCurrentPosition/watchPosition`, `haptic`, `openExternal`, `directionsUrl/mapViewUrl/openDirections`,
`applyNativeChrome/hideSplash/onAppState`, `isNative/platform/isIOS/isAndroid/isAppContext`)를
세 백엔드로 구현: Capacitor(iOS, `vendor/capacitor/core.js`를 네이티브에서만 지연 import),
Android WebView 브리지(`window.AndroidBridge` — 동작 동일 유지), 웹 폴백.
`static/js` 안에 `AndroidBridge` 직접 호출은 platform.js 한 곳뿐이다.
Capacitor 플러그인 프록시는 `withPlugin(name, fn)` 콜백으로만 넘긴다 — 프록시를 `await` 하면
`then()`이 네이티브 메서드로 호출돼 "StatusBar.then() is not implemented" 로 부팅이 죽는다(초기 iOS 빌드에서 실제 발생, 수정 완료).

### 2.2 데이터 모델·도메인
- 이용권 종류 3가지: **도장판(stamp, 적립)** / 횟수권(차감) / 금액권(잔액). 도장판은 마지막 칸이 보상 칸,
  완성 시 보상 안내 + 새 도장판 이어가기. 기존 DB(`CouponBookDB` v2) 레코드 형식은 그대로(추가 필드만).
- `reminderSchedule()`이 D-7/D-3/D-1 오전 9시 시각을 계산하고 `reminderId()`로 안정적인 int32 id를 만들어
  OS 예약 알림(iOS `UNUserNotificationCenter`, Android AlarmManager)에 넘긴다. 앱을 꺼 둬도 도착.
- 단위 테스트 64개 통과(`npm test`), e2e 스모크(`npm run test:e2e`) 통과.

### 2.3 UI/UX (after-sheet)
- 온보딩 3단계: 환영 → "첫 쿠폰 등록"(주 CTA) / "샘플로 둘러보기"(보조) → "만료 알림 켜기"(선택, 이때만 권한 요청).
  진행 점 표시, 건너뛰기, 온보딩 중엔 탭 바 숨김.
- 빈 홈: 일러스트 + "첫 쿠폰 등록" 주 CTA + "샘플로 둘러보기".
- 등록 폼: 빠른 시작 칩(카페 도장판 10칸 등 4종) → 이름·종류만 필수. 칸 수/횟수 칩(5·8·10·12·20), 스테퍼,
  만료일 칩(없음·1개월·3개월·6개월·1년), 전화/주소/위치/메모/코드/스킨은 "추가 정보(선택)" 접힘.
  인라인 검증(빈 이름, 범위 밖 숫자)과 햅틱.
- 카드: 가로 스와이프 캐러셀, 도장판은 5열 격자 + 선물 칸, 진행 바, 카드 위 "도장/사용" 원터치 + 되돌리기 토스트.
- 상세: 통계 3칸(칸/적립/남음 또는 총/사용/남음), 전화·지도·길찾기 3버튼, 보상 안내, 도장판/잔액, 코드(바코드+QR),
  "도장 찍기" 시트(개수 스테퍼 + 메모), 적립/사용 내역.
- 설정: 그룹형 리스트(알림 / 데이터 / 앱). 토글 두 개(가게 근처 알림, 만료 임박 알림), 자동 보관 상태,
  백업 내보내기·복원·영구 보관·샘플·전체 삭제, 정책·제작사·문의·버전.
- 레이아웃: 헤더/탭 바 safe-area(`env(safe-area-inset-*)`, `viewport-fit=cover`), 터치 타깃 ≥44px(`--tap`),
  텍스트 ≥12px, 호버 전용 어포던스 제거, `color-scheme: light` 고정, 하단 토스트, 부드러운 뷰 전환.
- 지도: 타일 실패/오프라인 시 안내 카드, 위치 권한 없어도 등록 가게 중심으로 동작, iOS는 Apple 지도 길찾기.
- 부팅 가드(`index.html`): 6초 안에 첫 뷰가 안 뜨면 원인과 "다시 시도" 버튼을 보여 준다.
- 백업 안내 배너: 데이터가 생긴 지 24시간이 지나기 전(첫 실행·샘플 직후)에는 띄우지 않고, 백업한 적이 없으면
  "아직 백업하지 않았어요", 있으면 "백업한 지 오래됐어요"로 문구를 나눔(iOS 첫 실행 캡처에서 "오래됐어요"가 바로 뜨던 문제).

### 2.4 iOS 플랫폼 — `ios/`, `capacitor.config.json`
- Capacitor 8.5(SPM), 플러그인: app, filesystem, share, local-notifications, geolocation, haptics, status-bar,
  splash-screen, preferences, browser, `@capacitor-community/admob`.
- 백업: Filesystem(Documents) 저장 + 공유 시트(파일에 저장/AirDrop/메일…). 파일 앱 › 쿠폰북 에서 보임
  (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`). 복원: WKWebView `<input type=file>` → 문서 선택기.
- 알림: 만료 알림을 켤 때만 권한 요청. 예약은 앱이 꺼져 있어도 발화. 가장 가까운 60건까지(iOS 64건 제한).
- 위치: `NSLocationWhenInUseUsageDescription`(ko+en 한 문장). 지도 탭을 열 때/근처 알림을 켤 때만 요청.
- 햅틱: 도장/사용/보상/오류/선택.
- 상태 표시줄 라이트 스타일, 스플래시(브랜드 블루 + 아이콘, `Splash.imageset`), 라이트 테마 고정(`UIUserInterfaceStyle=Light`).
- 광고: AdMob 적응형 배너(하단, `ADS_ENABLED` + `config.js` id). 첫 요청 전 ATT 프롬프트(`NSUserTrackingUsageDescription` ko+en),
  거부 시 `npa=1`. 배너 높이만큼 `--bottom-reserve`를 잡아 탭 바·콘텐츠를 가리지 않음. 오프라인/무필 시 공간 반환 + 재시도.
  **배너 단위 ID가 비어 있으면 SDK 초기화·ATT·예약 공간 모두 없음** — build 1의 상태.
- `Info.plist`: `CFBundleDisplayName` 쿠폰북, `ITSAppUsesNonExemptEncryption=false`, 세로 고정, `GADApplicationIdentifier`
  (실 iOS 앱 ID), SKAdNetworkItems 50개, `CFBundleLocalizations` ko/en.
- 서명: `project.pbxproj` Release = Manual / 237X7RZB63 / "Coupon Book App Store" / Apple Distribution. Debug는 Automatic(시뮬레이터용).
- 아이콘: `scripts/make-ios-icon.mjs` — `static/icon.svg`를 헤드리스 Chromium으로 1024×1024 렌더(RGB, 알파 없음).

### 2.5 내구성 — `services/snapshot.js`
변경 후 1.5초 디바운스로 전체 DB를 JSON 스냅샷으로 기록(iOS: Capacitor Filesystem **Library/**, 웹/Android: localStorage 미러),
백그라운드 진입·pagehide 때 즉시 flush. 실행 시 DB가 비어 있는데 스냅샷에 데이터가 있으면 조용히 복원하고
토스트 한 줄("저장된 백업에서 복원했어요 · 업체 N개"). 전체 삭제는 빈 스냅샷을 먼저 flush 하므로 되살아나지 않는다.

## 3. 결정 사항과 이유

| 결정 | 이유 |
| --- | --- |
| 라이트 테마 고정(`UIUserInterfaceStyle=Light`, `color-scheme: light`) | 스킨 그라데이션·일러스트가 라이트 기준으로 만들어져 있고 다크 팔레트를 반쪽으로 넣는 것이 더 나쁨(체크리스트 5). 웹도 동일 |
| UI는 한국어 전용, 스토어 문안은 ko + en-US | 도장판·회수권·금액권은 한국 생활 관행이고 샘플/카테고리/문안이 모두 한국 맥락. 전 세계 판매는 하되 심사 메모에 명시 |
| build 1은 광고 **꺼짐** | iOS 배너 광고 단위가 아직 없음. 테스트 ID를 스토어 빌드에 넣을 수 없고(`scripts/ios-archive.sh`가 `useTestAds: true`면 중단), 빈 ID = 광고 완전 비활성이 설계. 실 ID를 넣으면 재빌드만으로 켜짐 |
| 스냅샷을 Documents가 아닌 **Library/** 에 | 브리프는 Documents를 말했지만 Capacitor `DATA`=Documents는 파일 앱에 `coupon-book/snapshot.json`이 사용자 백업 옆에 노출됨(시뮬레이터에서 확인). Library는 앱 전용이면서 기기 백업에 포함되고 Caches처럼 지워지지 않음 |
| 사용자 백업 파일은 Documents + 공유 시트 | 파일 앱에서 보이고 iCloud Drive/AirDrop으로 내보내기 쉬움 |
| iPhone 전용, 세로 고정 | 480px 앱 셸 레이아웃이 폰 기준. iPad 스크린샷/레이아웃을 반쪽으로 내지 않음 |
| 길찾기 = Apple 지도(iOS) / 구글 지도(그 외) | 별도 앱 설치 없이 항상 동작 |
| 정책/홈페이지 링크는 인앱 Safari 시트 | 앱을 떠나지 않음, 연령 등급 "무제한 웹 액세스 아니요" 유지 |
| Capacitor core를 `static/vendor/capacitor/core.js`로 벤더링 | 저장소의 "빌드 단계 없음" 제약 유지. 웹/Android에서는 로드되지 않음 |
| XCUITest 드라이버(스크린샷·검증 자동화)는 저장소에 넣지 않음 | 프로젝트 파일이 임시 경로를 참조하게 되므로 검증 후 `project.pbxproj`를 원상 복구, 공유 스킴은 `App.xcscheme`만 |

## 4. iOS 빌드 검증 (시뮬레이터 iPhone 17 Pro Max, iOS 26.0, 2026-09-13)

| 항목 | 결과 |
| --- | --- |
| 콜드 스타트 → 온보딩 → 샘플 3개 → 홈 | 정상. 부팅 가드 미발동, JS 오류 없음 |
| 알림 권한 프롬프트 | "만료 알림 켜기"에서만 표시("허용 안 함 / 허용"), 허용 후 "만료 알림이 켜졌어요" 토스트 |
| ATT 프롬프트(테스트 광고 켠 개발 빌드) | 온보딩 완료 후 첫 광고 전에 1회, ko+en 문구 확인. 허용 시 320×50 테스트 배너가 탭 바 아래 예약 공간에 표시, 콘텐츠·탭 바 가림 없음 |
| 광고 꺼진 릴리스 설정(build 1과 동일) | 배너·예약 공간·ATT 모두 없음, 탭 바가 홈 인디케이터 위에 정렬 |
| 위치 권한 | 지도 탭 첫 진입 시 "한 번 허용 / 앱을 사용하는 동안 허용 / 허용 안 함" + 우리 문구. 허용 후 "위치 허용됨", 등록 가게 3곳 표시 |
| 홈 카드 도장/사용, 상세 "도장 찍기" 시트, 보상 완성 | 정상(되돌리기 토스트, 개수 스테퍼, 보상 안내) |
| 길찾기 | Apple 지도 앱으로 전환됨(`maps.apple.com?daddr=`) |
| 등록 폼 키보드 입력 | 한글 IME 입력·접근성 툴바(이전/다음/완료) 정상, 칩·스테퍼 동작 |
| 백업 내보내기 | Documents에 `coupon-backup-YYYY-MM-DD.json` 생성 + 공유 시트("파일에 저장" 등) → "마지막 백업" 갱신 |
| 백업 복원 | 문서 선택기(UIDocumentPicker) 열림 |
| 백그라운드 → 포그라운드, 강제 종료 → 재실행 | 데이터·화면 유지 |
| 저장소 소거 시뮬레이션(`WebsiteData/Default` 삭제 후 실행) | Library 스냅샷에서 자동 복원 + 토스트 |
| 세이프 에어리어 | 헤더가 Dynamic Island 아래, 탭 바가 홈 인디케이터 위. 온보딩은 탭 바 없이 인디케이터 여백 유지 |

검증 방법: 임시 XCUITest 타깃(스크래치 디렉터리의 `CouponDriver.swift`)이 JSON 단계 목록을 재생 —
접근성 스냅샷(`debugDescription`)에서 프레임/라벨을 파싱해 좌표 탭, SpringBoard 알림도 같은 방식.
WKWebView는 콘텐츠가 움직이는 동안 스냅샷을 계속 갱신해 `XCUIElement` 하나씩 해석하면
"Failed to get matching snapshot"으로 테스트가 중단되기 때문이다.

## 5. 남은 것 / 알려진 제약

- **AdMob 배너 단위 ID(iOS)** 미발급 → `config.js` `ADS.ios.bannerId` 비어 있음(광고 꺼짐). 발급 후 `useTestAds:false` 상태로
  값만 넣고 `CURRENT_PROJECT_VERSION` 2로 재아카이브, App Privacy를 변형 B로(`store/ios/listing.md` §9·§13).
- 실기기 미검증(시뮬레이터만). 햅틱·푸시 도착·공유 시트의 실제 앱 목록은 기기에서 확인 권장.
- VoiceOver 전수 점검은 하지 않음(라벨·역할은 갖춤: 카드 "… 상세 보기", 버튼 "… 도장 찍기" 등).
- Dynamic Type: 웹 폰트 크기는 시스템 글자 크기를 따르지 않음(고정 px). 최소 12px·주요 텍스트 14–16px로 가독성은 확보.
- 지도 타일은 인터넷 필요(OpenStreetMap). 오프라인 안내 상태는 웹에서 검증, 시뮬레이터는 항상 온라인.
- 스토어 스크린샷은 시뮬레이터 캡처 기반(실기기 아님). 상태 표시줄은 9:41로 통일.
- Android(`webview-app/`)는 이번에 손대지 않음. 웹 변경은 GitHub Pages 배포로 그대로 반영되고, 브리지 계약(`saveText`,
  `showNotification`, `scheduleReminder`, `cancelReminder`, `canNotify`)은 유지.

## 6. 산출물 (2026-09-13)

| 산출물 | 경로 |
| --- | --- |
| App Store IPA (build 1, 광고 꺼짐) | `~/Projects/_releases/쿠폰북/coupon-book-2.0.0-ios-build1.ipa` |
| xcarchive (+zip) | `~/Projects/_releases/쿠폰북/coupon-book-2.0.0-ios-build1.xcarchive(.zip)` |
| 스크린샷 ko / en | `store/ios/iphone-6.9/01..08.png`, `store/ios/iphone-6.9-en/01..08.png` (1320×2868) |
| 스토어 문안·심사 메모·App Privacy | `store/ios/listing.md` |
| 개인정보처리방침 (배포 대상) | `static/privacy.html` → https://coupon.lightonpluslab.com/privacy.html |
| 재현 스크립트 | `scripts/ios-archive.sh`, `scripts/make-ios-icon.mjs`, `scripts/make-ios-store-assets.py` |

IPA 검증: `codesign -dv --entitlements` → Identifier `com.lightonpluslab.couponbook`, Team `237X7RZB63`,
프로필 "Coupon Book App Store", `get-task-allow` = false; Info.plist → 2.0.0 / 1 / 쿠폰북 / `GADApplicationIdentifier`
`ca-app-pub-7180935400084577~3984818286` / `ITSAppUsesNonExemptEncryption` false. 아카이브·내보내기 로그에
"App Store Connect request for store configuration failed (no provider)" 한 줄이 남는데, Xcode에 Apple 계정이
없어서 나는 정보성 메시지이며 수동 서명 내보내기는 정상 완료된다.

