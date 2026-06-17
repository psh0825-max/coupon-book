# Tests

Two layers: fast unit tests (no browser) and a best-effort Playwright e2e smoke test.

## A) Unit tests (always runnable, no browser)

Node's built-in test runner against pure exported functions only
(`static/js/location.js`, `static/js/skins.js`). No DOM / IndexedDB / Leaflet.

```
npm test
```

Covers:
- `haversine` — Seoul City Hall -> Gangnam (~8.5 km, asserted 8-9 km), distance-to-self = 0, symmetry.
- `getCategoryIcon` — known category emoji, unknown -> default `🏪`.
- `getDefaultSkin` — known category skin, unknown -> `midnight`.

Result: 7 tests, all passing.

## B) E2E smoke test (Playwright + Chromium)

Spawns the Flask app on `COUPON_BOOK_PORT=7810` as a child process, waits on
`/healthz`, then drives the PWA in headless Chromium and tears the server down.

```
npm run test:e2e
```

The test (`tests/e2e/smoke.spec.mjs`):
1. Clears IndexedDB so the empty state appears.
2. Asserts the header shows `Coupon Book`.
3. Clicks the `샘플 보기` empty-state button to seed sample shops.
4. Asserts >=1 shop card appears in `#shop-rail`.
5. Clicks a card `사용` button and asserts a toast (`#toast.active`) or reward modal
   (`#reward-modal.active`) appears.
6. Navigates to the 지도 (map) and 설정 (settings) tabs, asserting no real console errors
   (Leaflet tile / favicon / service-worker network noise is filtered out).

Result: 1 test, passing.

### Prerequisites for e2e
- `@playwright/test` (installed as a devDependency) and the Chromium browser binary:
  ```
  npx playwright install chromium
  ```
- The Flask venv at `.venv/Scripts/python.exe` with the app dependencies installed.

### If Playwright / Chromium is unavailable
The e2e layer is best-effort. If the browser binary cannot be installed in your
environment, skip it — the unit layer (A) is fully self-contained and must stay green.
Manual smoke check, equivalent to the automated one:
1. Start the server: `COUPON_BOOK_PORT=7810 .venv/Scripts/python.exe app.py`
2. Open `http://127.0.0.1:7810`. Header reads "Coupon Book".
3. Click `샘플 보기` — sample shops fill the "내 쿠폰" rail.
4. Click `사용` on a card — a "쿠폰이 사용되었어요!" toast (or a reward modal when the
   last stamp completes) appears.
5. Tap the 지도 and 설정 tabs — each section activates with no console errors.
