# Google Play 출시 runbook — 쿠폰북 TWA

이 문서는 쿠폰북(이미 GitHub Pages에 배포된 정적 PWA)을 **TWA(Trusted Web
Activity)** 로 감싸 Google Play에 올리는 단계별 절차입니다.

- 앱 URL: <https://psh0825-max.github.io/coupon-book/>
- 개인정보처리방침 공개 URL: <https://psh0825-max.github.io/coupon-book/privacy.html>

> 참고: Play 없이도 안드로이드/아이폰에서 브라우저의 **‘홈 화면에 추가’** 로
> 설치형처럼 무료로 쓸 수 있습니다(이미 PWA). Play 출시는 “스토어 노출”이 목적일
> 때만 필요합니다.

---

## 1. 사전 요건

- **Google Play Console 개발자 계정** — 최초 1회 등록비 **$25**.
- **개인정보처리방침 공개 URL** —
  `https://psh0825-max.github.io/coupon-book/privacy.html` (본 레포에 포함됨).
- **512px 아이콘** — 이미 `static/icon-512.png` 존재.
- **그래픽 자산** — 피처 그래픽 1024×500 등은 Play Console에서 직접 업로드
  (스크린샷은 아래 6단계 참고).

---

## 2. 빠른 경로(권장) — PWABuilder

1. <https://www.pwabuilder.com/> 접속.
2. URL 입력: `https://psh0825-max.github.io/coupon-book/` → 분석 실행.
3. **Package For Stores → Android** 선택.
4. 옵션에서 **package name** 지정 (예: `io.github.psh0825max.couponbook`).
   - 한 번 정한 패키지명은 이후 변경 불가하니 신중히 정합니다.
5. **signing key 는 PWABuilder가 생성/관리**합니다.
   - 이 키의 **SHA-256 지문**을 `assetlinks.json` 에 넣어야 합니다(3단계).
   - 키 정보를 안전하게 보관하세요(분실 시 동일 앱 업데이트 불가).
6. **.aab** 다운로드 + 함께 제공되는 **`assetlinks.json`** 을 확인합니다
   (package_name과 SHA-256 지문이 이미 채워져 있음).

---

## 3. Digital Asset Links 연결

TWA가 주소창 없이 전체화면으로 뜨려면, 도메인이 “이 안드로이드 앱을 신뢰한다”는
것을 증명해야 합니다.

1. PWABuilder가 알려주는 **package_name** 과 **SHA-256 지문** 을
   `rootdomain/.well-known/assetlinks.json` 의 자리표시자에 채웁니다.
2. 이 파일을 **도메인 루트 레포(`psh0825-max.github.io`)** 에 배포합니다.
   - 자세한 방법은 [`rootdomain/README.md`](rootdomain/README.md) 참고.
   - 최종 위치: `https://psh0825-max.github.io/.well-known/assetlinks.json`
3. **검증**: 앱을 설치해 실행했을 때 **주소창이 사라지면 성공**입니다.
   연결에 실패하면 TWA가 브라우저 탭처럼 상단에 주소창을 표시합니다.

---

## 4. 대안 경로 — Bubblewrap CLI

PWABuilder가 더 쉽지만, CLI를 선호하면 `@bubblewrap/cli` 를 쓸 수 있습니다.

- 요건: **JDK 17** + **Android SDK**.
- 절차:
  ```
  npm i -g @bubblewrap/cli
  bubblewrap init --manifest https://psh0825-max.github.io/coupon-book/manifest.json
  bubblewrap build
  ```
- 결과물: `app-release-bundle.aab` + `assetlinks.json` 생성.
  (생성된 지문/패키지명을 3단계처럼 도메인 루트에 배포.)

---

## 5. Play Console 업로드

1. **앱 만들기** — 이름/기본 언어/앱 유형(앱)/무료 선택.
2. **트랙 선택** — 먼저 **내부 테스트** 트랙으로 검증한 뒤 **프로덕션** 으로
   올리는 것을 권장.
3. 선택한 트랙에 **.aab 업로드**.
4. **앱 콘텐츠** 작성:
   - **개인정보처리방침 URL**:
     `https://psh0825-max.github.io/coupon-book/privacy.html`
   - **데이터 보안 설문**: 이 앱은 서버 전송이 없으므로
     **‘데이터 수집/공유 없음’** 으로 정확히 작성.
   - **콘텐츠 등급** 설문 작성.
   - **타겟 고객/연령** 작성.
5. **스토어 등록정보**:
   - 스크린샷 **최소 2장**, 아이콘, 짧은 설명/긴 설명.
6. **검토 제출**.

---

## 6. 주의사항

- TWA는 단순 웹 래퍼라도 **PWA로서 실사용 가치**가 있어야 합니다(본 앱 해당:
  오프라인 동작·설치형·실제 기능 제공).
- 최신 **target API level 요건**, **개인정보처리방침**, **데이터 보안 설문**을
  모두 충족해야 심사를 통과합니다.
- 처음에는 **내부 테스트 트랙**으로 먼저 검증하는 것을 강력히 권장합니다.
- 서명 키(특히 PWABuilder/Bubblewrap가 만든 키)는 분실하면 앱 업데이트가
  불가능하니 안전하게 백업하세요.
