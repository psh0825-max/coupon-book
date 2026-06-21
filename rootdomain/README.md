# rootdomain/ — 도메인 루트에 올려야 하는 파일들

이 폴더의 파일들은 **앱이 사는 `/coupon-book/` 하위 경로가 아니라 도메인 루트**에서
서빙되어야 합니다. TWA의 Digital Asset Links와 AdSense의 `ads.txt`는 모두 도메인
루트에서만 읽히기 때문입니다:

- `https://psh0825-max.github.io/.well-known/assetlinks.json`
- `https://psh0825-max.github.io/ads.txt`

> 앱 자체(`https://psh0825-max.github.io/coupon-book/`)에 이 파일들을 둬도
> **소용이 없습니다.** 반드시 루트(`https://psh0825-max.github.io/`)에서 응답해야 합니다.

## 포함된 파일

```
rootdomain/
├── .well-known/
│   └── assetlinks.json   # TWA Digital Asset Links (앱↔도메인 연결 증명)
└── ads.txt               # AdSense 퍼블리셔 검증
```

## github.io 프로젝트 사이트에서 루트를 소유하는 방법

`psh0825-max.github.io/coupon-book/` 는 **프로젝트 사이트**라서, 그 루트
(`psh0825-max.github.io/`)는 이 레포가 아니라 **사용자/조직 Pages 레포**가 소유합니다.
그 레포의 이름은 정확히 **`psh0825-max.github.io`** 여야 합니다.

### 절차

1. GitHub에서 **`psh0825-max.github.io`** 라는 이름의 **public** 레포를 만듭니다
   (이미 있으면 그대로 사용).
2. 이 폴더의 파일들을 그 레포 루트로 복사합니다. **`.well-known` 폴더 구조를 그대로
   유지**해야 합니다:
   ```
   psh0825-max.github.io/
   ├── .well-known/
   │   └── assetlinks.json
   └── ads.txt
   ```
3. 커밋 후 푸시하고, 그 레포의 GitHub Pages가 켜져 있는지 확인합니다
   (Settings → Pages). 잠시 뒤 위의 두 URL에서 파일이 응답합니다.
4. 브라우저로 `https://psh0825-max.github.io/.well-known/assetlinks.json` 과
   `https://psh0825-max.github.io/ads.txt` 가 정상적으로 열리는지 확인합니다.

> 대안: coupon-book Pages 사이트에 **커스텀 도메인**을 연결하고, 그 도메인의
> 루트에 이 파일들을 두는 방법도 있습니다.

## 채워 넣어야 하는 값

### `assetlinks.json`

- `package_name` — 안드로이드 앱 패키지명 (예: `io.github.psh0825max.couponbook`).
- `sha256_cert_fingerprints` — 앱 서명 키의 SHA-256 지문.

두 값을 얻는 곳:

- **PWABuilder**: Android 패키지를 생성하면 함께 내려오는 `assetlinks.json`에
  package_name과 SHA-256 지문이 이미 들어 있습니다. 그 값을 그대로 복사하세요.
- **keytool** (직접 서명 키를 관리하는 경우):
  ```
  keytool -list -v -keystore <키파일> -alias <별칭>
  ```
  출력의 `SHA256:` 항목이 지문입니다 (콜론 포함 16진수).

### `ads.txt`

- `pub-REPLACE_WITH_PUBLISHER_DIGITS` 를 AdSense 퍼블리셔 숫자로 바꿉니다
  (`ca-pub-1234567890123456` → `pub-1234567890123456`).
- AdSense를 실제로 켜기 전까지는 이 파일을 굳이 배포하지 않아도 됩니다.

자세한 Play 출시 절차는 레포 루트의 [`PLAY.md`](../PLAY.md)를 참고하세요.
