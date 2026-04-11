#!/bin/bash
# post-install script for Linux (.deb) packages
# This ensures that /usr/local/bin/atlas points to the installed Atlas-Sandbox

BIN_PATH="/opt/Atlas-Sandbox/atlas-sandbox"
LINK_TARGET="/usr/local/bin/atlas"

echo "[Atlas] Setting up path for Linux..."

# Create symlink if the target executable exists
if [ -f "$BIN_PATH" ]; then
    ln -sf "$BIN_PATH" "$LINK_TARGET"
    echo "Symlink created at $LINK_TARGET"
fi

exit 0
