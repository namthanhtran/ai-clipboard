#!/bin/bash
set -e

REPO="namthanhtran/ai-clipboard"
TMPDIR=$(mktemp -d)
trap "rm -rf \"$TMPDIR\"" EXIT

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

# Find the .app directly from the mac output directory
APP=$(find dist/mac* -maxdepth 1 -name "*.app" -print -quit 2>/dev/null)

if [ -z "$APP" ]; then
  echo "Build failed: no .app found in dist/"
  exit 1
fi

echo "Installing to /Applications..."
cp -r "$APP" /Applications/

echo ""
echo "Done! Clipboard Manager installed."
echo "Open it from Spotlight or run: open '/Applications/Clipboard Manager.app'"
