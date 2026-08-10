#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

version="${1:-$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')}"
output_dir="release-artifacts"
chromium_archive="$output_dir/opencanvas-$version-chromium.zip"
firefox_archive="$output_dir/opencanvas-$version-firefox.zip"

mkdir -p "$output_dir"
rm -f "$chromium_archive" "$firefox_archive"
python3 -m zipfile -c "$chromium_archive" LICENSE manifest.json popup src
cp "$chromium_archive" "$firefox_archive"

printf 'Created %s\nCreated %s\n' "$chromium_archive" "$firefox_archive"
