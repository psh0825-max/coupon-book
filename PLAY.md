# Google Play 출시 runbook — 쿠폰북 TWA

이 문서는 쿠폰북(이미 GitHub Pages에 배포된 정적 PWA)을 **TWA(Trusted Web
Activity)** 로 감싸 Google Play에 올리는 단계별 절차입니다.

- 앱 URL: <https://coupon.lightonpluslab.com/>
  (사용자 사이트 `lightonpluslab.com` 의 서브도메인. 최상위(apex) 도메인은 계속
  LightOn Plus Lab 홈페이지로 유지됨.)
- 개인정보처리방침 공개 URL: <https://coupon.lightonpluslab.com/privacy.html>
  (도메인 전환 전까지는 기존 `https://psh0825-max.github.io/coupon-book/privacy.html` 도 동작.)

> 참고: Play 없이도 안드로이드/아이폰에서 브라우저의 **‘홈 화면에 추가’** 로
> 설치형처럼 무료로 쓸 수 있습니다(이미 PWA). Play 출시는 “스토어 노출”이 목적일
> 때만 필요합니다.

---

## 1. 사전 요건

- **Google Play Console 개발자 계정** — 라이트온플러스랩(LightOn Plus Lab)
  명의로 등록된 계정. 최초 1회 등록비 **$25**.
- **개인정보처리방침 공개 URL** —
  `https://coupon.lightonpluslab.com/privacy.html` (본 레포의 `static/privacy.html`).
- **512px 아이콘** — 이미 `static/icon-512.png` 존재.
- **그래픽 자산** — 피처 그래픽 1024×500 등은 Play Console에서 직접 업로드
  (스크린샷은 아래 6단계 참고).

---

## 2. 빠른 경로(권장) — PWABuilder

1. <https://www.pwabuilder.com/> 접속.
2. URL 입력: `https://coupon.lightonpluslab.com/` → 분석 실행.
3. **Package For Stores → Android** 선택.
4. 옵션에서 **package name** 지정 (예: `com.lightonpluslab.couponbook`).
   - 한 번 정한 패키지명은 이후 변경 불가하니 신중히 정합니다.
5. **signing key 는 PWABuilder가 생성/관리**합니다.
   - 이 키의 **SHA-256 지문**을 `assetlinks.json` 에 넣어야 합니다(3단계).
   - 키 정보를 안전하게 보관하세요(분실 시 동일 앱 업데이트 불가).
6. **.aab** 다운로드 + 함께 제공되는 **`assetlinks.json`** 을 확인합니다
   (package_name과 SHA-256 지문이 이미 채워져 있음).

---

## 3. 커스텀 도메인 연결 (Cloudflare DNS + GitHub Pages)

앱을 서브도메인 `coupon.lightonpluslab.com` 에서 서빙합니다. 앱의 상대경로는
도메인 루트에서 그대로 동작하므로 코드 변경은 필요 없습니다.

### 3-1. Cloudflare DNS 레코드 추가

1. Cloudflare 대시보드 → **lightonpluslab.com** → **DNS** → **Add record**.
2. 다음 값으로 레코드를 만듭니다:
   - **Type**: `CNAME`
   - **Name**: `coupon`
   - **Target**: `psh0825-max.github.io`
   - **Proxy status**: **DNS only** (회색 구름) — GitHub이 HTTPS 인증서를
     발급하려면 프록시(주황 구름)를 끄고 **DNS only** 여야 합니다. 중요.
3. **Save**.

### 3-2. GitHub Pages 커스텀 도메인 설정

1. coupon-book 레포 → **Settings → Pages** → **Custom domain** 에
   `coupon.lightonpluslab.com` 입력 → **Save**.
2. 인증서 프로비저닝이 끝나면 **Enforce HTTPS** 를 켭니다.
3. ⚠️ 배포는 `git subtree push --prefix static origin gh-pages` 로 이뤄지므로,
   `static/CNAME` 파일(내용: `coupon.lightonpluslab.com`)을 커밋해 두어야 매
   배포마다 커스텀 도메인 설정이 유지됩니다.
   - **이 `static/CNAME` 파일은 위 Cloudflare 레코드가 적용된 뒤에만** 추가/배포
     합니다. 먼저 올리면 현재 `github.io` URL이 깨질 수 있습니다.

---

## 4. Digital Asset Links 연결

TWA가 주소창 없이 전체화면으로 뜨려면, 도메인이 “이 안드로이드 앱을 신뢰한다”는
것을 증명해야 합니다.

1. PWABuilder가 알려주는 **package_name** 과 **SHA-256 지문** 을
   `static/.well-known/assetlinks.json` 의 자리표시자에 채웁니다.
2. 이 파일은 `static/` 에 있으므로 일반 배포로 서브도메인 루트에서 서빙됩니다.
   별도의 `psh0825-max.github.io` 루트 레포는 더 이상 필요하지 않습니다.
   - 최종 위치: `https://coupon.lightonpluslab.com/.well-known/assetlinks.json`
     (TWA가 정확히 이 위치를 찾습니다.)
3. **검증**: 앱을 설치해 실행했을 때 **주소창이 사라지면 성공**입니다.
   연결에 실패하면 TWA가 브라우저 탭처럼 상단에 주소창을 표시합니다.

---

## 5. 대안 경로 — Bubblewrap CLI

PWABuilder가 더 쉽지만, CLI를 선호하면 `@bubblewrap/cli` 를 쓸 수 있습니다.

- 요건: **JDK 17** + **Android SDK**.
- 절차:
  ```
  npm i -g @bubblewrap/cli
  bubblewrap init --manifest https://coupon.lightonpluslab.com/manifest.json
  bubblewrap build
  ```
- 결과물: `app-release-bundle.aab` + `assetlinks.json` 생성.
  (생성된 지문/패키지명을 4단계처럼 `static/.well-known/assetlinks.json` 에 채워 배포.)

---

## 6. Play Console 업로드

1. **앱 만들기** — 이름/기본 언어/앱 유형(앱)/무료 선택.
2. **트랙 선택** — 먼저 **내부 테스트** 트랙으로 검증한 뒤 **프로덕션** 으로
   올리는 것을 권장.
3. 선택한 트랙에 **.aab 업로드**.
4. **앱 콘텐츠** 작성:
   - **개인정보처리방침 URL**:
     `https://coupon.lightonpluslab.com/privacy.html`
   - **데이터 보안 설문**: AdSense 광고가 **켜져 있으므로** ‘데이터 수집/공유
     없음’이 **아닙니다**. 다음과 같이 작성:
     - 사용자가 입력하는 앱 데이터(쿠폰·사진·메모 등)는 기기 로컬(IndexedDB)에만
       저장 → **앱 자체 수집 없음**.
     - 단, 제3자(Google 광고 서비스)가 광고 게재를 위해 수집하는 항목을 신고:
       **기기 또는 기타 ID(광고 ID)** + **광고 상호작용(앱 활동)**.
       - 수집: **예** / 공유: **예**(광고 파트너) / 처리 목적: **광고 또는
         마케팅** / 사용자 선택 여부: **필수**(앱 사용 시 광고 표시).
   - **광고 포함 여부**: 스토어 등록정보의 “앱에 광고가 포함되어 있나요?” →
     반드시 **예**(광고 라벨 표시). 콘텐츠 등급 설문 답변과 일관성 유지.
   - **콘텐츠 등급** 설문 작성.
   - **타겟 고객/연령** 작성 (13세 미만 타겟 아님으로 — 아동 대상 선언 시 광고
     정책이 훨씬 엄격해짐).
5. **스토어 등록정보**:
   - 스크린샷 **최소 2장**, 아이콘, 짧은 설명/긴 설명.
   - **개발자 이름**: `LightOn Plus Lab`.
   - **지원 이메일**: `psh0825@gmail.com`.
6. **검토 제출**.

---

## 7. 주의사항

- TWA는 단순 웹 래퍼라도 **PWA로서 실사용 가치**가 있어야 합니다(본 앱 해당:
  오프라인 동작·설치형·실제 기능 제공).
- 최신 **target API level 요건**, **개인정보처리방침**, **데이터 보안 설문**을
  모두 충족해야 심사를 통과합니다.
- **target API 36**: 2026-08-31부터 신규 앱/업데이트는 **API 36(Android 16)**
  타겟이 필수입니다. `twa-build/app/build.gradle` 의 `targetSdkVersion` 을 36으로
  올려 재빌드하세요(이 레포는 이미 36으로 올려 둠 — v1.0.2 / versionCode 4).
- **광고 UX/동의**:
  - AdSense **Auto Ads의 앵커(하단 고정) 광고**가 앱 하단 네비게이션을 가릴 수
    있습니다. AdSense 대시보드 → Auto ads 설정에서 **앵커 광고를 끄거나 위치를
    상단으로 제한**하세요.
  - EEA/영국에 배포하려면 AdSense **개인정보 보호 및 메시지(CMP)** 에서 동의
    메시지를 설정해야 합니다. 설정하지 않을 경우 Play Console에서 **배포 국가를
    제한**하는 것이 안전합니다(예: 한국만).
- 처음에는 **내부 테스트 트랙**으로 먼저 검증하는 것을 강력히 권장합니다.
- 서명 키(특히 PWABuilder/Bubblewrap가 만든 키)는 분실하면 앱 업데이트가
  불가능하니 안전하게 백업하세요.
