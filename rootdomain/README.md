# rootdomain/ — (참고용) 도메인 루트 서빙 파일

> **쿠폰 앱에는 더 이상 필요 없습니다.** 앱은 서브도메인
> `https://coupon.lightonpluslab.com/` 에서 서빙되고, TWA의 `assetlinks.json` 과
> AdSense `ads.txt` 는 모두 `static/` 안에 있어 서브도메인 **루트**에서 바로
> 응답합니다:
>
> - `https://coupon.lightonpluslab.com/.well-known/assetlinks.json` → `static/.well-known/assetlinks.json`
> - `https://coupon.lightonpluslab.com/ads.txt` → `static/ads.txt`
>
> 따라서 별도의 `psh0825-max.github.io` 루트 레포는 쿠폰 앱 용도로는 필요하지
> 않습니다. 자세한 절차는 [`PLAY.md`](../PLAY.md) 참고.

## 이 폴더를 남겨 두는 이유 (apex 도메인 케이스)

AdSense 사이트를 서브도메인이 아니라 **apex 도메인 `lightonpluslab.com`** 으로
등록하는 경우, AdSense는 apex 루트(`https://lightonpluslab.com/ads.txt`)에서
`ads.txt` 를 읽습니다. 그 위치는 이 쿠폰 레포가 아니라 **메인 사이트 레포**가
소유하므로, 그때는 이 폴더의 `ads.txt` 를 참고해 메인 사이트 루트에 별도로
배포해야 합니다.

## 채워 넣어야 하는 값

- `ads.txt` — `pub-XXXXXXXXXXXXXXXX` 를 AdSense 퍼블리셔 숫자로 교체.
- `assetlinks.json` — `package_name` 과 `sha256_cert_fingerprints` 를 PWABuilder/
  keytool 에서 얻은 값으로 교체 (쿠폰 앱은 `static/.well-known/assetlinks.json` 을
  사용하므로 이 폴더 파일은 apex 케이스 참고용).
