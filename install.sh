#!/bin/bash
set -e

echo "Installing Clipboard Manager..."

# Install dependencies
npm install

# Build and package
npm run dist:mac

# Find the built .dmg
DMG=$(find dist -name "*.dmg" | head -1)

if [ -z "$DMG" ]; then
  echo "Build failed: no .dmg found in dist/"
  exit 1
fi

echo "Mounting $DMG..."
MOUNT=$(hdiutil attach "$DMG" -nobrowse -noautoopen | tail -1 | awk '{print $NF}')

APP=$(find "$MOUNT" -name "*.app" | head -1)
echo "Installing $APP to /Applications..."
cp -r "$APP" /Applications/

hdiutil detach "$MOUNT" -quiet

echo ""
echo "Done! Clipboard Manager installed to /Applications."
echo "Open it from Spotlight or /Applications/Clipboard Manager.app"
