#!/bin/bash
set -e

REPO="namthanhtran/ai-clipboard"
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "Installing Clipboard Manager..."

# Check dependencies
for cmd in git node npm; do
  if ! command -v $cmd &>/dev/null; then
    echo "Error: $cmd is required but not installed."
    exit 1
  fi
done

# Clone
echo "Cloning repository..."
git clone --depth 1 "https://github.com/$REPO.git" "$TMPDIR/clipboard-manager"
cd "$TMPDIR/clipboard-manager"

# Install & build
echo "Installing dependencies..."
npm install

echo "Building app..."
npm run dist:mac

# Install
DMG=$(find dist -name "*.dmg" | head -1)

if [ -z "$DMG" ]; then
  echo "Build failed: no .dmg found in dist/"
  exit 1
fi

echo "Mounting $DMG..."
MOUNT=$(hdiutil attach "$DMG" -nobrowse -noautoopen | tail -1 | awk '{print $NF}')

APP=$(find "$MOUNT" -name "*.app" | head -1)
echo "Installing to /Applications..."
cp -r "$APP" /Applications/

hdiutil detach "$MOUNT" -quiet

echo ""
echo "Done! Clipboard Manager installed."
echo "Open it from Spotlight or run: open '/Applications/Clipboard Manager.app'"
