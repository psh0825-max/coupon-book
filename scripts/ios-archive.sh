#!/bin/zsh
# scripts/ios-archive.sh — App Store archive + IPA export for 쿠폰북 (iOS).
#
#   ./scripts/ios-archive.sh            # archive + export + verify
#   ./scripts/ios-archive.sh --no-copy  # skip `npx cap copy ios` (web assets unchanged)
#
# Manual signing lives INSIDE ios/App/App.xcodeproj (Release config): team
# 237X7RZB63, profile "Coupon Book App Store", identity "Apple Distribution".
# Never pass PROVISIONING_PROFILE_SPECIFIER on the command line — it leaks into
# the SPM package targets and the archive fails.
#
# Output: ~/Projects/_releases/쿠폰북/coupon-book-<version>-ios-build<N>.ipa
#         ~/Projects/_releases/쿠폰북/coupon-book-<version>-ios-build<N>.xcarchive.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PBX=ios/App/App.xcodeproj/project.pbxproj
VERSION=$(grep -m1 'MARKETING_VERSION' "$PBX" | sed -E 's/.*= *([0-9.]+);/\1/')
BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' "$PBX" | sed -E 's/.*= *([0-9]+);/\1/')
OUT_DIR="$HOME/Projects/_releases/쿠폰북"
NAME="coupon-book-${VERSION}-ios-build${BUILD}"
ARCHIVE="$OUT_DIR/${NAME}.xcarchive"
EXPORT_DIR="$OUT_DIR/export-${NAME}"
mkdir -p "$OUT_DIR"

# Release guard: the archive must never carry Google's TEST ad unit.
if grep -q "useTestAds: true" static/js/config.js; then
  echo "✖ static/js/config.js has useTestAds: true — set it to false before archiving." >&2
  exit 1
fi

if [[ "${1:-}" != "--no-copy" ]]; then
  echo "== npx cap copy ios =="
  npx cap copy ios
fi

echo "== archive ${NAME} =="
rm -rf "$ARCHIVE"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -skipMacroValidation -skipPackagePluginValidation archive \
  | grep -E "error:|warning: .*App/|Signing Identity|ARCHIVE" || true
[[ -d "$ARCHIVE" ]] || { echo "✖ archive missing" >&2; exit 1; }

echo "== export IPA =="
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist ios/ExportOptions.plist | grep -E "error:|EXPORT" || true
IPA_SRC=$(ls "$EXPORT_DIR"/*.ipa | head -1)
cp -f "$IPA_SRC" "$OUT_DIR/${NAME}.ipa"

echo "== zip xcarchive =="
rm -f "$OUT_DIR/${NAME}.xcarchive.zip"
(cd "$OUT_DIR" && ditto -c -k --keepParent "${NAME}.xcarchive" "${NAME}.xcarchive.zip")

echo "== verify =="
TMP=$(mktemp -d)
unzip -o -q "$OUT_DIR/${NAME}.ipa" -d "$TMP"
APP=$(ls -d "$TMP"/Payload/*.app | head -1)
codesign -dv --entitlements - "$APP" 2>&1 | grep -E "Identifier=|TeamIdentifier=|application-identifier|beta-reports-active|get-task-allow" || true
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' -c 'Print :CFBundleShortVersionString' -c 'Print :CFBundleVersion' -c 'Print :CFBundleDisplayName' -c 'Print :GADApplicationIdentifier' -c 'Print :ITSAppUsesNonExemptEncryption' "$APP/Info.plist"
rm -rf "$TMP"
echo "✔ $OUT_DIR/${NAME}.ipa"
echo "✔ $OUT_DIR/${NAME}.xcarchive.zip"
