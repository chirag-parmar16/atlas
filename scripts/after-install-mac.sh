#!/bin/bash
# post-install script for macOS DMG packages
# This ensures that /usr/local/bin/atlas points to the installed Atlas-Sandbox

DEST_DIR="/Applications/Atlas-Sandbox.app/Contents/MacOS"
LINK_TARGET="/usr/local/bin/atlas"

echo "[Atlas] Setting up path for macOS..."

# Create symlink if the target directory exists and it's not already linked
if [ -d "$DEST_DIR" ]; then
    # We link the actual bash wrapper so the node environment variables are set
    # Wait, the app bundle in a standard electron-builder target might not contain the bash wrapper.
    # Let's link the executable itself, and users can rely on Atlas-Sandbox being in path.
    # Actually, electron-builder puts extraFiles relative to the app Root? 
    # Let's map it to the raw executable inside the bundle.
    ln -sf "$DEST_DIR/Atlas-Sandbox" "$LINK_TARGET"
    echo "Symlink created at $LINK_TARGET"
fi

exit 0
