# Google Play 출시 runbook — 쿠폰북 (WebView 셸 + AdMob)

쿠폰북 안드로이드 앱의 출시·업데이트 절차입니다. **2026-07-17 아키텍처 전환**:
기존 TWA(Trusted Web Activity)를 **WebView 셸 + 네이티브 AdMob 배너**로
교체했습니다.

- 앱 URL: <https://coupon.lightonpluslab.com/>
- 개인정보처리방침: <https://coupon.lightonpluslab.com/privacy.html>
- 안드로이드 프로젝트: `webview-app/` (구 `twa-build/`는 아카이브·폴백으로 보존)
- 패키지: `com.lightonpluslab.couponbook.twa` (기존과 동일 — 같은 리스팅의
  업데이트로 배포됨)

## 0. 왜 전환했나 (한 단락 요약)

앱 수익화를 AdMob으로 하기로 결정했는데, **AdMob은 네이티브 SDK라 TWA(Chrome이
웹을 렌더) 안에는 붙일 방법이 없습니다.** 반대로 AdSense는 웹사이트 전용 제품이라
앱 안에서 돌리면 무효 트래픽/계정 정지 위험이 있습니다. 그래서:

- **앱** = WebView 셸이 사이트를 로드 + 하단에 **네이티브 AdMob 배너**.
- **웹**(브라우저 방문자) = 기존 **AdSense** 유지.
- 셸이 UserAgent에 `CouponBookApp/2.0`을 실어 보내고, 웹의
  `isAppContext()`(`static/js/services/ads.js`)가 이를 감지해 **앱 안에서는
  AdSense를 로드하지 않습니다.** 두 광고 제품이 절대 겹치지 않음.
- WebView에 없는 기능(백업 다운로드·시스템 알림·백그라운드 만료 알람·위치 권한)은
  네이티브 브리지(`window.AndroidBridge`)로 대체 구현됨 — `webview-app/README.md` 참고.

## 1. 현재 상태 (2026-07-28 — Play Console 실측)

- **v1.0.2 (versionCode 4, TWA)** — 심사 통과. **비공개 테스트(Alpha) 트랙에 전체
  출시 완료**(2026-07-03 게시). 번들 활성, 배포국 1개.
- **v1.0.1 (vc3)** — 내부 테스트 트랙 활성. **v1.0.0 (vc1)** — 비활성.
- **v2.0.0 (versionCode 5, WebView 셸)** — **빌드·서명 완료**
  (`webview-app/app/build/outputs/bundle/release/app-release.aab`, 2026-07-17,
  targetSdk 36 / minSdk 23, 업로드 키로 서명됨). 남은 것은 AdMob 테스트 ID를
  실 ID로 교체하는 것뿐 — §4.
- 등록정보 초안(홍보영상 URL, 새 스크린샷 6장, 피처그래픽 v2)은 전송 대기 상태.
- **프로덕션 = 비활성**(한 번도 출시된 적 없음). ← 현재 유일한 병목.

### 1.1 target API 정책 경고 — 프로덕션 게시로만 해제됨

정책 상태에 경고가 떠 있음(조치 기한 **2026-08-31**):

> **앱이 Android 16(API 수준 36) 이상을 타겟팅해야 함**
> 해결 방법: (1) API 36 이상 타겟팅 (2) **앱의 새 버전을 프로덕션에 게시**.
> 그 전에 내부·비공개·공개 테스트로 테스트할 수 있음.

- (1)은 이미 충족 — vc4·vc5 모두 targetSdk 36. **(2)가 미충족**이며
  **테스트 트랙 게시는 해결로 인정되지 않음.**
- 실질 리스크는 낮음: 이 정책의 강제력은 "API 36 미만 바이너리 업로드 거부"인데
  우리 빌드는 이미 36이라 기한이 지나도 업로드가 막히지 않음. 콘솔 배지만 남음.
  세부정보 페이지에 `기한 연장 요청` 버튼도 있음.
- 즉 컴플라이언스 화재가 아니라 **프로덕션 출시 일정 문제**로 다룰 것.

### 1.2 프로덕션 액세스 조건 (개인 계정) — 임계 경로

- [x] 비공개 테스트 버전 게시 — 완료(vc4)
- [ ] **12명 이상의 테스터가 "참여 선택(opt-in)"** — **현재 0명**
- [ ] 12명 대상 **14일 이상** 비공개 테스트 지속

**함정**: Alpha 트랙 이메일 목록에는 이미 85명이 등록돼 있음
(`Internal Testers` 30명 + `라이트온플러스랩 - momoi 비공개 테스트` 55명).
그런데 opt-in은 0명 — **목록 등록은 참여 선택이 아님**. 각 테스터가 아래 링크를
열어 직접 "테스터 되기"를 눌러야 카운트됨.

- opt-in URL: <https://play.google.com/apps/testing/com.lightonpluslab.couponbook.twa>
- 스토어 링크:
  <https://play.google.com/store/apps/details?id=com.lightonpluslab.couponbook.twa>

역산 일정(2026-07-28 기준, 기한까지 34일):

```
12명 opt-in 완료(D) → D+14 요건 충족 → 프로덕션 액세스 신청
→ 심사(수일~수주) → 프로덕션 출시 심사 → 8/31
```

opt-in이 하루 늦어질 때마다 버퍼가 그대로 줄어듦.

### 1.3 진행 방침 (2026-07-28 결정)

- 14일 테스트는 **vc4(현행 TWA)로 그대로 진행** — 이미 게시돼 있어 추가 빌드 불필요.
- **v2.0.0은 병렬 준비** — AdMob 실 ID 확보 후 §4의 2곳 교체 → 재빌드 → §5로 제출.
  14일 카운트를 리셋하지 않도록, v2.0.0 업로드는 프로덕션 액세스 승인 이후를 권장.

## 2. 사전 요건

- JDK 17 (`C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot`) + Android SDK
  (compileSdk 36) — TWA 빌드 때와 동일.
- 기존 업로드 키: `twa-build/couponbook-upload.keystore` (alias `couponbook`,
  비밀번호는 `twa-build/keystore-credentials.txt`). **같은 키로 서명해야 같은
  리스팅에 업데이트됩니다.** 분실 시 앱 업데이트 불가 — 백업 유지.
- **AdMob 계정** (사용자 직접 생성 — §4).

## 3. 빌드 절차 (`webview-app/`)

상세 명령은 `webview-app/README.md`에 있음. 요약:

1. **최초 1회**: `twa-build/`에서 gradle wrapper(`gradlew.bat`, `gradle/`)와
   런처 아이콘(`mipmap-*`)을 복사 (README §2의 copy/xcopy 명령 그대로).
2. **서명 설정**: `webview-app/keystore.properties` 작성 (git-ignore 됨):
   ```
   storeFile=../twa-build/couponbook-upload.keystore
   storePassword=<키스토어 비밀번호>
   keyAlias=couponbook
   keyPassword=<키 비밀번호>
   ```
   (경로는 `webview-app/` 루트 기준. 없으면 미서명 AAB → TWA 때처럼 jarsigner로
   수동 서명.)
3. **빌드**: `webview-app/`에서
   ```
   .\gradlew.bat bundleRelease    # AAB → app/build/outputs/bundle/release/
   .\gradlew.bat assembleDebug    # 실기기 테스트용 APK (테스트 광고 표시)
   ```
4. 실기기 스모크 테스트: 앱 부팅(온보딩/홈) → 하단에 "Test Ad" 배너 →
   이용권 추가·사용 → 설정에서 백업 내보내기(다운로드 폴더 저장) →
   지도(위치 권한 프롬프트) → 전화/길찾기 링크가 외부 앱으로 → 뒤로가기 동작.
   **테스트 광고는 클릭해도 안전**합니다(테스트 ID일 때만).

## 4. AdMob 실계정 연결 (출시 전 필수)

지금은 구글 공개 테스트 ID — 수익이 발생하지 않습니다. 절차:

1. <https://admob.google.com> 에서 계정 생성 (AdSense와 같은 Google 계정이어도
   **AdMob 게시자 ID는 별도 발급**됩니다 — AdSense의 `pub-7180935400084577`과
   다른 번호가 나옴).
2. 앱 등록(안드로이드, 패키지 `com.lightonpluslab.couponbook.twa`) → **앱 ID**
   (`ca-app-pub-…~…`) 발급.
3. 광고단위 생성: **배너** 1개 → **광고단위 ID**(`ca-app-pub-…/…`) 발급.
4. 코드에서 **정확히 2곳** 교체:
   - `webview-app/app/build.gradle` → `admobAppId: 'ca-app-pub-3940256099942544~3347511713'`
   - `webview-app/app/src/main/java/com/lightonpluslab/couponbook/twa/MainActivity.java`
     → `BANNER_UNIT_ID = "ca-app-pub-3940256099942544/6300978111"`
5. **app-ads.txt**: `static/app-ads.txt` 파일을 새로 만들어 배포:
   ```
   google.com, pub-<AdMob 게시자 ID 숫자>, DIRECT, f08c47fec0942fa0
   ```
   - AdMob은 **Play 등록정보의 개발자 웹사이트** 루트에서 이 파일을 크롤링합니다.
     Play Console 스토어 등록정보의 웹사이트를
     `https://coupon.lightonpluslab.com` 으로 설정하면 `static/`가 그대로 루트라
     추가 인프라가 필요 없습니다. (기존 `static/ads.txt`는 웹 AdSense용 — 별개
     파일이며 둘 다 유지.)
6. ⚠️ 실제 ID로 바꾼 뒤에는 **본인 기기에서 실광고를 클릭하지 마세요**(무효
   트래픽 정책). 개발 중 재테스트가 필요하면 AdMob 콘솔에 테스트 기기를
   등록하거나 테스트 ID로 되돌려서 하세요.

## 5. Play Console 제출 (v2.0.0)

1. 현재 v1.0.2 심사가 끝난 뒤, **비공개 테스트(Alpha) 트랙에 v2.0.0 AAB 업로드**
   (versionCode 5 > 4라 자동으로 업데이트 취급).
2. **광고 ID 선언 변경 — 하드 블로커**: 앱 콘텐츠 → 광고 ID. 현재 "사용 안
   함"으로 선언돼 있는데(TWA는 웹쿠키 기반이라 맞았음), `play-services-ads`가
   `com.google.android.gms.permission.AD_ID` 권한을 자동 병합하므로 그대로 두면
   **API 33+ 릴리스가 거부됩니다.** → **"광고 ID 사용함"**, 목적 = 광고 또는
   마케팅으로 변경.
3. **데이터 보안 설문**: 이미 신고된 항목(기기 또는 기타 ID 수집/공유, 광고
   상호작용, 목적=광고)이 AdMob SDK 기준으로도 그대로 유효 — 내용 변경 불필요,
   수집 주체의 근거만 웹쿠키→네이티브 SDK로 바뀐 것. 제출 전 한 번 훑어 확인.
4. "앱에 광고 포함" = **예** 유지. 콘텐츠 등급·타겟층 변경 없음.
5. 심사 완료 후 전송 대기 중이던 **등록정보 초안**(영상/스크린샷/피처그래픽
   v2)을 이번 제출에 묶어서 전송.
6. 출시 노트 예시: "광고 표시 방식 개선 및 알림 안정화" (내부 아키텍처 전환은
   사용자 표기 불필요).

## 6. ⚠️ 데이터 저장소 주의 (TWA → WebView 전환의 유일한 파괴적 변화)

TWA는 **Chrome 프로필**의 IndexedDB에, WebView 셸은 **앱 자체 WebView 저장소**에
데이터를 둡니다. 즉 TWA 버전을 쓰던 기기가 v2.0.0으로 업데이트하면 **앱이 빈
상태로 보입니다**(데이터가 삭제된 건 아니고 Chrome 쪽에 남아 있음 — Chrome으로
사이트를 열면 그대로 있음).

- **지금 전환해야 하는 이유**: 현재 사용자 = Alpha 테스터뿐(프로덕션 0명).
  프로덕션 출시 전인 지금이 저장소를 갈아탈 마지막 무비용 시점입니다.
- 기존 테스터 안내문 예시: "업데이트 후 데이터가 비어 보이면 —
  ① Chrome에서 coupon.lightonpluslab.com 접속 → 설정 → 백업(JSON 내보내기)
  ② 앱에서 설정 → 복원(가져오기)." (JSON 백업/복원 기능은 양쪽에 이미 있음.)
- 웹 방문자·PWA 설치 사용자는 영향 없음.

## 7. 정책 주의사항

- **최소 기능성(웹뷰 래퍼) 정책**: 단순 사이트 래핑 앱은 거부될 수 있습니다.
  본 앱은 오프라인 동작(SW), 네이티브 알림/백그라운드 만료 알람, 위치 기반
  근처 알림, 파일 백업 등 실기능이 있으므로 해당 근거를 심사 소명 시 활용.
- **EEA/영국 배포 시**: AdMob도 동의(UMP SDK) 필수. 현재 배포국 = 대한민국만이라
  불필요. 확장 전에 UMP 통합 또는 배포국 유지.
- **target API**: 2026-08-31부터 API 36 필수 — `twa-build`(vc4)·`webview-app`(vc5)
  모두 이미 targetSdk 36이라 **바이너리 요건은 충족**. 남은 건 프로덕션 게시 —
  §1.1 참조. minSdk는 TWA 21 → WebView 셸 **23**(Android 6.0+, 커버리지 영향
  사실상 없음).
- 서명 키·`keystore-credentials.txt` 백업 유지(분실 = 업데이트 불가).

## 8. 웹(AdSense) 쪽에서 계속 유효한 것

- 웹 방문자용 AdSense는 그대로: `ads.js`의 `AD_CONFIG.enabled = true`,
  게시자 `ca-pub-7180935400084577`, `static/ads.txt` 유지.
- AdSense 대시보드의 **앵커 광고 끄기** 권고는 이제 "모바일 웹 방문자" 이슈로만
  유효(앱은 AdSense를 아예 안 씀).
- `static/.well-known/assetlinks.json`은 **삭제하지 마세요** — WebView 셸에는
  불필요하지만 PWA 링크 처리에 무해하고, TWA로 되돌릴 일이 생기면 다시 필요.

## 부록 — 구 TWA 경로 (아카이브)

`twa-build/`(Bubblewrap 생성, v1.0.2/vc4)는 참고·폴백용으로 보존. PWABuilder /
Bubblewrap / assetlinks 상세 절차가 필요하면 git 이력의 이전 PLAY.md
(2026-07-03판) 참조.
