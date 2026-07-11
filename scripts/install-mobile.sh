#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"

ANDROID_PACKAGE="com.duanluyao.kaoyanflashcards"
ANDROID_APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"
IOS_WORKSPACE="$ROOT_DIR/ios/app.xcworkspace"
IOS_SCHEME="app"
IOS_BUILD_DIR="${TMPDIR:-/tmp}/english-word-remember-ios-build"
IOS_APP="$IOS_BUILD_DIR/Build/Products/Release-iphoneos/app.app"

usage() {
  cat <<'EOF'
用法：
  ./scripts/install-mobile.sh android
  ./scripts/install-mobile.sh ios
  ./scripts/install-mobile.sh all

当连接多台设备时，请通过环境变量指定目标：
  ANDROID_DEVICE_ID=<adb-serial> ./scripts/install-mobile.sh android
  IOS_DEVICE_ID=<coredevice-id> ./scripts/install-mobile.sh ios

脚本会构建 Release 版本并覆盖安装，尽量保留已有应用数据。
EOF
}

log() {
  printf '\n[%s] %s\n' "install-mobile" "$1"
}

fail() {
  printf '\n[install-mobile] 错误：%s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

select_android_device() {
  local devices count
  devices="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')"

  if [[ -n "${ANDROID_DEVICE_ID:-}" ]]; then
    printf '%s\n' "$devices" | grep -Fxq "$ANDROID_DEVICE_ID" || fail "未找到安卓设备：$ANDROID_DEVICE_ID"
    printf '%s' "$ANDROID_DEVICE_ID"
    return
  fi

  count="$(printf '%s\n' "$devices" | sed '/^$/d' | wc -l | tr -d ' ')"
  [[ "$count" -gt 0 ]] || fail "未检测到已授权的安卓设备，请开启 USB 调试。"
  [[ "$count" -eq 1 ]] || fail "检测到多台安卓设备，请设置 ANDROID_DEVICE_ID。"
  printf '%s' "$devices"
}

select_ios_device() {
  local json_file devices count
  json_file="$(mktemp "${TMPDIR:-/tmp}/install-mobile-ios.XXXXXX")"
  xcrun devicectl list devices --json-output "$json_file" >/dev/null

  devices="$(python3 - "$json_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)

for device in payload.get("result", {}).get("devices", []):
    hardware = device.get("hardwareProperties", {})
    connection = device.get("connectionProperties", {})
    properties = device.get("deviceProperties", {})
    if (
        hardware.get("platform") == "iOS"
        and hardware.get("reality") == "physical"
        and connection.get("pairingState") == "paired"
        and properties.get("developerModeStatus") == "enabled"
    ):
        print(device.get("identifier", ""))
PY
)"
  rm -f "$json_file"

  if [[ -n "${IOS_DEVICE_ID:-}" ]]; then
    printf '%s\n' "$devices" | grep -Fxq "$IOS_DEVICE_ID" || fail "未找到可用的 iOS 设备：$IOS_DEVICE_ID"
    printf '%s' "$IOS_DEVICE_ID"
    return
  fi

  count="$(printf '%s\n' "$devices" | sed '/^$/d' | wc -l | tr -d ' ')"
  [[ "$count" -gt 0 ]] || fail "未检测到已配对且开启开发者模式的 iPhone。"
  [[ "$count" -eq 1 ]] || fail "检测到多台 iOS 设备，请设置 IOS_DEVICE_ID。"
  printf '%s' "$devices"
}

resolve_java_home() {
  local candidate

  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    printf '%s' "$JAVA_HOME"
    return
  fi

  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"; do
    if [[ -x "$candidate/bin/java" ]]; then
      printf '%s' "$candidate"
      return
    fi
  done

  candidate="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  [[ -n "$candidate" && -x "$candidate/bin/java" ]] || fail "未找到 JDK 17，请安装 Android Studio 或 OpenJDK 17。"
  printf '%s' "$candidate"
}

install_android() {
  local device_id="$1" java_home
  java_home="$(resolve_java_home)"

  log "构建 Android Release"
  (
    cd "$ROOT_DIR/android"
    JAVA_HOME="$java_home" PATH="$java_home/bin:$PATH" ./gradlew assembleRelease
  )

  [[ -f "$ANDROID_APK" ]] || fail "Android APK 未生成：$ANDROID_APK"
  log "安装到 Android 设备 $device_id"
  adb -s "$device_id" install -r "$ANDROID_APK"
  adb -s "$device_id" shell pm path "$ANDROID_PACKAGE" >/dev/null || fail "Android 安装后校验失败。"
  log "Android 安装完成"
}

install_ios() {
  local device_id="$1"

  log "构建 iOS Release"
  NODE_ENV=production xcodebuild \
    -workspace "$IOS_WORKSPACE" \
    -scheme "$IOS_SCHEME" \
    -configuration Release \
    -destination "id=$device_id" \
    -derivedDataPath "$IOS_BUILD_DIR" \
    -allowProvisioningUpdates \
    build

  [[ -d "$IOS_APP" ]] || fail "iOS App 未生成：$IOS_APP"
  log "安装到 iOS 设备 $device_id"
  xcrun devicectl device install app --device "$device_id" "$IOS_APP"
  log "iOS 安装完成"
}

case "$TARGET" in
  android)
    require_command adb
    android_device="$(select_android_device)"
    install_android "$android_device"
    ;;
  ios)
    require_command xcodebuild
    require_command xcrun
    require_command python3
    ios_device="$(select_ios_device)"
    install_ios "$ios_device"
    ;;
  all)
    require_command adb
    require_command xcodebuild
    require_command xcrun
    require_command python3
    android_device="$(select_android_device)"
    ios_device="$(select_ios_device)"
    install_android "$android_device"
    install_ios "$ios_device"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    fail "不支持的目标：$TARGET"
    ;;
esac
