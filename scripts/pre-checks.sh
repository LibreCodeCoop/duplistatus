#!/bin/sh

# run pre-checks before running the pnpm dev or pnpm build or start

#get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

#get the root directory
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# -----  start of pre-checks  -----

# Check if the key file exists (skip in Docker build)
if [ -f "$SCRIPT_DIR/ensure-key-file.sh" ]; then
  $SCRIPT_DIR/ensure-key-file.sh
fi

# Update the version
$SCRIPT_DIR/update-version.sh

# -----  end of pre-checks  -----
exit 0

