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
.\gradlew.bat assembleDebug      # 테스트 APK (테스트 광고 뜸)
```

---

## 5. ⚠️ 실제 AdMob ID 교체 (출시 전 필수)
지금은 **구글 공개 테스트 ID**라 테스트 광고만 뜹니다. AdMob 콘솔에서 앱 등록 후 2곳 교체:

1. **앱 ID** — `app/build.gradle` 의
   `admobAppId: 'ca-app-pub-3940256099942544~3347511713'` → 실제 `ca-app-pub-…~…`
2. **배너 광고단위 ID** — `MainActivity.java` 의
   `BANNER_UNIT_ID = "ca-app-pub-3940256099942544/6300978111"` → 실제 `ca-app-pub-…/…`

> 실제 ID로 바꾸기 전에 실기기에서 실제 광고를 클릭하지 마세요(AdMob 무효 트래픽 정책). 테스트 ID는 클릭해도 안전합니다.

## 6. Play Console 변경점 (자세한 건 ../PLAY.md)
- **데이터 보안**: AdMob SDK는 **광고 ID(AD_ID)** 를 수집/공유합니다 — 이미 신고돼 있던 항목과 동일하나, TWA(웹쿠키)에서 **네이티브 SDK**로 근거가 바뀝니다. 광고 ID 권한 선언을 **사용함**으로.
- 패키지·키가 같으므로 알파 트랙에 그대로 업로드하면 됩니다(versionCode 5).
- minSdk 23(Android 6.0). 더 낮은 기기가 필요하면 `app/build.gradle`에서 낮추되 `play-services-ads` 호환 버전을 확인하세요.
