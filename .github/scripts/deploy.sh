#!/usr/bin/env bash
set -euo pipefail

# Incremental deploy driven by a content-hash manifest, not file size/mtime.
#
# dist/ is rebuilt from scratch on every run, so every local file is always
# "newer" than whatever's on the server. lftp's --only-newer/--ignore-time
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

# REMOTE_ROOT ends up embedded, single-quoted, inside lftp -e command
# strings below. lftp's own quoting/escaping rules for its command
# language aren't reliably documented, so rather than trying to escape a
# literal single quote correctly, refuse to run if one is present. For
# preview deploys REMOTE_ROOT is derived from a PR branch name, and a
# single quote is legal in a git ref name, so this is reachable via an
# innocuous branch name, not just a hostile one.
if [[ "$REMOTE_ROOT" == *"'"* ]]; then
  echo "REMOTE_ROOT must not contain a single quote: $REMOTE_ROOT" >&2
  exit 1
fi

# Collapse any run of repeated slashes into one. A caller joining an
# already "/"-rooted value (e.g. SERVER_TARGET=/) with "/preview/<branch>/"
# produces a literal "//preview/...", which is well-defined behavior on
# some systems but not something to depend on.
REMOTE_ROOT=$(printf '%s' "$REMOTE_ROOT" | sed -E 's#/+#/#g')

MANIFEST_REMOTE="${REMOTE_ROOT%/}/.deploy-manifest.txt"

# Credentials via -u/-p rather than embedded in an sftp:// URL: SFTP_PASS
# is an opaque secret we don't control the character set of, and a
# URL-embedded password containing '@', ':' or '/' would be misparsed.
lftp_conn=(-u "${SFTP_USER},${SFTP_PASS}" -p "$SFTP_PORT" "sftp://${SFTP_HOST}")

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

# 1. Manifest of the freshly built dist/. -print0/-z/-0 throughout so a
#    filename containing whitespace can't desync xargs' word-splitting
#    (which would otherwise pass fragments of the name to sha256sum as
#    separate, nonexistent paths).
(cd "$DIST_DIR" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) >"$work_dir/new-manifest.txt"

# A build that produced zero files (partial/failed build, wrong DIST_DIR)
# would otherwise diff as "every previously-deployed file was deleted" and
# wipe the whole remote target. Refuse instead.
if [[ ! -s "$work_dir/new-manifest.txt" ]]; then
  echo "$DIST_DIR contains no files; refusing to deploy (this would delete everything remote)" >&2
  exit 1
fi

# 2. Manifest of what's actually on the server right now (absent on a brand
#    new preview path or the very first deploy under this scheme, so
#    treat everything as new then). Truncate explicitly on failure rather than
#    relying on the (possibly partial) file lftp's failed get may have left
#    behind.
if ! lftp "${lftp_conn[@]}" -e "get '${MANIFEST_REMOTE}' -o '$work_dir/old-manifest.txt'; bye"; then
  : >"$work_dir/old-manifest.txt"
fi
sort -o "$work_dir/old-manifest.txt" "$work_dir/old-manifest.txt"
sort -o "$work_dir/new-manifest.txt" "$work_dir/new-manifest.txt"

# 3. Files whose "<hash>  <path>" line is new (new path, or same path with a
#    changed hash) need uploading; files whose path disappeared need
#    deleting. Paths are extracted by fixed column offset (sha256sum's
#    format is a 64-char hex digest + " " + a mode flag + the filename,
#    i.e. the filename always starts at column 67) rather than by
#    whitespace-splitting, which would truncate any filename containing a
#    space at its first space.
comm -13 "$work_dir/old-manifest.txt" "$work_dir/new-manifest.txt" \
  | cut -c 67- >"$work_dir/to_upload.txt"

comm -23 \
  <(cut -c 67- "$work_dir/old-manifest.txt" | sort) \
  <(cut -c 67- "$work_dir/new-manifest.txt" | sort) \
  >"$work_dir/to_delete.txt"

echo "Files to upload: $(wc -l <"$work_dir/to_upload.txt")"
echo "Files to delete: $(wc -l <"$work_dir/to_delete.txt")"

# 4. Remove files that dropped out of the build, before uploading anything.
#    Doing this first (rather than after the upload) means a path that
#    changed kind between builds (was a file, now a directory, or vice
#    versa) doesn't collide with the stale entry still sitting on the
#    remote. Best-effort: a path may already be gone, which isn't fatal, so
#    individual failures here don't abort the job. Paths containing a
#    single quote are skipped rather than embedded unescaped (see the
#    REMOTE_ROOT check above for why).
if [[ -s "$work_dir/to_delete.txt" ]]; then
  delete_script="set cmd:fail-exit no;"
  has_delete=0
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    if [[ "$rel" == *"'"* ]]; then
      echo "::warning::Skipping delete of path containing a single quote: $rel" >&2
      continue
    fi
    delete_script+=" rm -f '${REMOTE_ROOT%/}/${rel#./}';"
    has_delete=1
  done <"$work_dir/to_delete.txt"
  if [[ "$has_delete" -eq 1 ]]; then
    lftp "${lftp_conn[@]}" -e "${delete_script} bye" \
      || echo "::warning::Delete pass reported a failure; any files it didn't remove will be retried next deploy" >&2
  fi
fi

# 5. Stage changed/added files in a pruned tree that mirrors their paths,
#    then upload just that pruned tree. No --delete here: this pass must
#    never remove anything beyond what step 3 explicitly identified.
if [[ -s "$work_dir/to_upload.txt" ]]; then
  upload_dir="$work_dir/upload"
  mkdir -p "$upload_dir"
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    mkdir -p "$upload_dir/$(dirname "$rel")"
    cp "$DIST_DIR/$rel" "$upload_dir/$rel"
  done <"$work_dir/to_upload.txt"

  lftp "${lftp_conn[@]}" -e "mirror --reverse --parallel=10 --verbose=1 '$upload_dir/' '$REMOTE_ROOT'; bye"
fi

# 6. Publish the new manifest so the next deploy diffs against reality
lftp "${lftp_conn[@]}" -e "put '$work_dir/new-manifest.txt' -o '${MANIFEST_REMOTE}'; bye"

echo "Deploy complete."
