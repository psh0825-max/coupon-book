# 쿠폰북 — WebView 셸 앱 (AdMob)

기존 **TWA를 대체**하는 안드로이드 앱입니다. TWA(크롬 Custom Tab 렌더)로는 **AdMob**(네이티브 SDK)을 띄울 수 없어서, `WebView`가 `https://coupon.lightonpluslab.com/` 을 로드하고 그 **아래에 네이티브 AdMob 배너**를 붙이는 셸로 만들었습니다.

- 웹(브라우저 방문자)은 계속 **AdSense**로 수익화됩니다.
- 앱은 UserAgent에 `CouponBookApp/2.0` 태그를 실어, 웹의 `isAppContext()`가 이를 감지해 **앱 안에서는 AdSense를 끕니다**(정책 위험 제거). 앱 광고는 오직 네이티브 AdMob 배너.
- `com.lightonpluslab.couponbook.twa` 패키지·기존 업로드 키로 서명하면 **기존 Play 리스팅의 업데이트**(versionCode 5 / 2.0.0)로 올라갑니다. 테스터·스토어 자산 그대로 유지.

기존 `../twa-build/` 는 **건드리지 않았습니다**(폴백/참고용으로 보존).

---

## 0. 기능 회귀 방지 브리지 (이미 구현됨)
바닐라 WebView는 크롬/TWA와 달리 blob 다운로드·웹 Notification·SW periodic sync가 없어서, 웹이 앱 컨텍스트에서 네이티브를 호출하도록 배선했습니다(`window.AndroidBridge`):
- **위치**(근처 알림·현재 위치): `onGeolocationPermissionsShowPrompt` + 런타임 위치 권한.
- **백업 내보내기**: `saveText()` → 다운로드 폴더에 JSON 저장(`static/js/services/backup.js`).
- **만료 알림**: 앱 실행 중 즉시 알림은 `showNotification()`, 앱이 닫혀도 뜨는 예약 알림은 `scheduleReminder()`(AlarmManager)로 처리(`static/js/services/reminders.js`).
- 예약된 만료 알림은 네이티브에 저장되며, 기기 재부팅 또는 앱 업데이트 후 다시 예약됩니다.
- **외부 링크**(tel:/지도/정책): 시스템 인텐트로 위임. **뒤로가기**: WebView 히스토리 우선.

---

## 1. 사전 요건 (TWA와 동일)
- JDK 17 (`C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot`)
- Android SDK (compileSdk 36)

## 2. 최초 1회 세팅 (바이너리는 레포에 없음 — 복사 필요)
```
# (a) Gradle wrapper 복사
copy ..\twa-build\gradlew.bat .\
copy ..\twa-build\gradlew .\
xcopy /E /I ..\twa-build\gradle .\gradle

# (b) 런처 아이콘 복사(기존 브랜드 아이콘 재사용)
xcopy /E /I ..\twa-build\app\src\main\res\mipmap-anydpi-v26 .\app\src\main\res\mipmap-anydpi-v26
xcopy /E /I ..\twa-build\app\src\main\res\mipmap-hdpi     .\app\src\main\res\mipmap-hdpi
xcopy /E /I ..\twa-build\app\src\main\res\mipmap-mdpi     .\app\src\main\res\mipmap-mdpi
xcopy /E /I ..\twa-build\app\src\main\res\mipmap-xhdpi    .\app\src\main\res\mipmap-xhdpi
xcopy /E /I ..\twa-build\app\src\main\res\mipmap-xxhdpi   .\app\src\main\res\mipmap-xxhdpi
xcopy /E /I ..\twa-build\app\src\main\res\mipmap-xxxhdpi  .\app\src\main\res\mipmap-xxxhdpi
```

## 3. 서명 설정 (기존 리스팅 업데이트용)
`webview-app/keystore.properties` 를 만들고(커밋 금지 — .gitignore 처리됨):
```
storeFile=../twa-build/couponbook-upload.keystore
storePassword=<기존 키스토어 비밀번호>
keyAlias=couponbook
keyPassword=<기존 키 비밀번호>
```
없으면 릴리스 AAB가 미서명으로 나오며, TWA 때처럼 `jarsigner`로 수동 서명하면 됩니다.

## 4. 빌드
```
.\gradlew.bat bundleRelease      # AAB → app/build/outputs/bundle/release/
.\gradlew.bat assembleDebug      # 테스트 APK (구글 테스트 광고가 표시되며 클릭해도 안전)
```

`release`와 `qa`는 `app/proguard-rules.pro`에서 `@JavascriptInterface` 메서드를 보존한 R8 최소화 빌드입니다. `gradlew assembleQa`로 디버그 가능 WebView와 Google 테스트 광고를 사용하는 최소화 빌드를 실기기에서 테스트할 수 있으며, AAB에는 Play가 충돌을 역난독화할 R8 매핑 파일이 포함됩니다.

브리지 메서드: `saveText`, `showNotification`, `scheduleReminder`, `cancelReminder`, `canNotify`, `requestNotificationPermission`, `setPresentationMode`.

---

## 5. AdMob ID 구성
ID는 `app/build.gradle`의 빌드 타입별로 설정됩니다. `debug`는 구글 공개 테스트 ID라
`assembleDebug`에서 "Test Ad"가 표시되고 클릭해도 안전하며, `release`는 실제 AdMob ID를
사용합니다. `MainActivity`는 `BuildConfig.BANNER_UNIT_ID`를 읽습니다.

## 6. Play Console 변경점 (자세한 건 ../PLAY.md)
- **데이터 보안**: AdMob SDK는 **광고 ID(AD_ID)** 를 수집/공유합니다 — 이미 신고돼 있던 항목과 동일하나, TWA(웹쿠키)에서 **네이티브 SDK**로 근거가 바뀝니다. 광고 ID 권한 선언을 **사용함**으로.
- 패키지·키가 같으므로 알파 트랙에 그대로 업로드하면 됩니다(versionCode 5).
- minSdk 24(Android 7.0) — Google Play 자동 보호가 24 이상을 요구함. 더 낮은 기기가 필요하면 `app/build.gradle`에서 낮추되 `play-services-ads` 호환 버전을 확인하세요.
