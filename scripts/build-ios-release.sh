#!/usr/bin/env bash

# Build a device Release app and package an unsigned IPA for local re-signing.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/outputs/ios-release"
BUILD_DIR="$OUTPUT_DIR/build"
PACKAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/english-word-remember-ipa.XXXXXX")"
trap 'rm -rf "$PACKAGE_DIR"' EXIT

VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
IPA_NAME="english-word-remember-${VERSION}-ios-unsigned.ipa"
mkdir -p "$OUTPUT_DIR"

NODE_ENV=production xcodebuild \
  -workspace "$ROOT_DIR/ios/app.xcworkspace" \
  -scheme app \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY= \
  build

mkdir -p "$PACKAGE_DIR/Payload"
ditto "$BUILD_DIR/Build/Products/Release-iphoneos/app.app" "$PACKAGE_DIR/Payload/app.app"
if [[ -f "$PACKAGE_DIR/Payload/app.app/embedded.mobileprovision" ]]; then
  printf 'Refusing to publish an IPA containing a provisioning profile.\n' >&2
  exit 1
fi
ditto -c -k --keepParent "$PACKAGE_DIR/Payload" "$PACKAGE_DIR/$IPA_NAME"
mv "$PACKAGE_DIR/$IPA_NAME" "$OUTPUT_DIR/$IPA_NAME"
(
  cd "$OUTPUT_DIR"
  shasum -a 256 "$IPA_NAME" > "$IPA_NAME.sha256"
)
printf '\nUnsigned IPA: %s\n' "$OUTPUT_DIR/$IPA_NAME"
