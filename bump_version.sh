#!/usr/bin/env bash
set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
  echo "Usage: bash bump_version.sh <version>"
  echo "Example: bash bump_version.sh v0.2.0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "$VERSION" > "$SCRIPT_DIR/version.txt"
sed -i "s|/maestro/v[^/]*/install\.sh|/maestro/$VERSION/install.sh|" "$SCRIPT_DIR/README.md"

echo "Bumped to $VERSION"
