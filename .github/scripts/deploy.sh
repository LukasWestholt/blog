#!/usr/bin/env bash
set -euo pipefail

# Incremental deploy driven by a content-hash manifest, not file size/mtime.
#
# dist/ is rebuilt from scratch on every run, so every local file is always
# "newer" than whatever's on the server -- lftp's --only-newer/--ignore-time
# comparison is meaningless here and previously caused index.html to go
# stale while pointing at asset hashes that had already been deleted
# (see PR #53's incident writeup). This script instead diffs a sha256
# manifest of the current build against the manifest of the last deploy
# (stored on the server itself) and only transfers what actually changed.
#
# Required env: SFTP_HOST, SFTP_PORT, SFTP_USER, SFTP_PASS, REMOTE_ROOT
# Optional env: DIST_DIR (default: dist)

DIST_DIR="${DIST_DIR:-dist}"
REMOTE_ROOT="${REMOTE_ROOT:?REMOTE_ROOT is required}"
MANIFEST_REMOTE="${REMOTE_ROOT%/}/.deploy-manifest.txt"
SFTP_URL="sftp://${SFTP_USER}:${SFTP_PASS}@${SFTP_HOST}:${SFTP_PORT}"

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

# 1. Manifest of the freshly built dist/
(cd "$DIST_DIR" && find . -type f | sort | xargs -r sha256sum) >"$work_dir/new-manifest.txt"

# 2. Manifest of what's actually on the server right now (absent on the
#    very first run under this scheme -- treat everything as new then)
lftp -e "get '${MANIFEST_REMOTE}' -o '$work_dir/old-manifest.txt'; bye" "$SFTP_URL" \
  || true
touch "$work_dir/old-manifest.txt"
sort -o "$work_dir/old-manifest.txt" "$work_dir/old-manifest.txt"
sort -o "$work_dir/new-manifest.txt" "$work_dir/new-manifest.txt"

# 3. Files whose "<hash>  <path>" line is new (new path, or same path with a
#    changed hash) need uploading; files whose path disappeared need deleting
comm -13 "$work_dir/old-manifest.txt" "$work_dir/new-manifest.txt" \
  | awk '{print $2}' >"$work_dir/to_upload.txt"

comm -23 \
  <(awk '{print $2}' "$work_dir/old-manifest.txt" | sort) \
  <(awk '{print $2}' "$work_dir/new-manifest.txt" | sort) \
  >"$work_dir/to_delete.txt"

echo "Files to upload: $(wc -l <"$work_dir/to_upload.txt")"
echo "Files to delete: $(wc -l <"$work_dir/to_delete.txt")"

# 4. Stage changed/added files in a pruned tree that mirrors their paths
upload_dir="$work_dir/upload"
mkdir -p "$upload_dir"
while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  mkdir -p "$upload_dir/$(dirname "$rel")"
  cp "$DIST_DIR/$rel" "$upload_dir/$rel"
done <"$work_dir/to_upload.txt"

# 5. Upload only the staged files. No --delete here: this pass must never
#    remove anything beyond what step 3 explicitly identified.
if [[ -s "$work_dir/to_upload.txt" ]]; then
  lftp -e "mirror --reverse --parallel=3 --verbose=3 '$upload_dir/' '$REMOTE_ROOT'; bye" "$SFTP_URL"
fi

# 6. Remove files that dropped out of the build. Best-effort: a path may
#    already be gone, which isn't fatal, so failures here don't abort the job.
if [[ -s "$work_dir/to_delete.txt" ]]; then
  delete_script="set cmd:fail-exit no;"
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    delete_script+=" rm -f '${REMOTE_ROOT%/}/${rel#./}';"
  done <"$work_dir/to_delete.txt"
  lftp -e "${delete_script} bye" "$SFTP_URL" || true
fi

# 7. Publish the new manifest so the next deploy diffs against reality
lftp -e "put '$work_dir/new-manifest.txt' -o '${MANIFEST_REMOTE}'; bye" "$SFTP_URL"

echo "Deploy complete."
