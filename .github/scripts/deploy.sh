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
# Optional env: DIST_DIR (default: dist), FULL_SYNC (default: false)
#
# FULL_SYNC=true bypasses the manifest diff entirely and does an
# unconditional `mirror --delete` of dist/ onto REMOTE_ROOT, to fix drift
# the manifest doesn't know about. Deliberate disaster-recovery action,
# not the routine deploy path.

DIST_DIR="${DIST_DIR:-dist}"
readonly DIST_DIR
REMOTE_ROOT="${REMOTE_ROOT:?REMOTE_ROOT is required}"
FULL_SYNC="${FULL_SYNC:-false}"
readonly FULL_SYNC

# Every value below gets embedded, single-quoted, into an lftp -e command
# string. lftp's quoting/escaping rules for its command language aren't
# reliably documented, so callers refuse to use a value this matches
# rather than trying to escape it.
contains_single_quote() {
  [[ "$1" == *"'"* ]]
}

if contains_single_quote "$REMOTE_ROOT"; then
  # For preview deploys REMOTE_ROOT is derived from a PR branch name, and a
  # single quote is legal in a git ref name, so this is reachable via an
  # innocuous branch name, not just a hostile one.
  echo "REMOTE_ROOT must not contain a single quote: $REMOTE_ROOT" >&2
  exit 1
fi

# Collapse repeated slashes (a caller joining "/"-rooted SERVER_TARGET with
# "/preview/<branch>/" produces "//preview/..."), then strip a trailing
# slash so REMOTE_ROOT is canonically slash-free from here on. Call sites
# that need a trailing slash add it back explicitly.
REMOTE_ROOT=$(printf '%s' "$REMOTE_ROOT" | sed -E 's#/+#/#g')
REMOTE_ROOT="${REMOTE_ROOT%/}"
readonly REMOTE_ROOT

readonly MANIFEST_REMOTE="$REMOTE_ROOT/.deploy-manifest.txt"

# Credentials via -u/-p rather than an sftp://user:pass@host URL: SFTP_PASS
# is an opaque secret and a password containing '@', ':' or '/' would be
# misparsed if embedded in a URL.
readonly lftp_conn=(-u "${SFTP_USER},${SFTP_PASS}" -p "$SFTP_PORT" "sftp://${SFTP_HOST}")

run_lftp() {
  # delete_removed's command already ends in ";" (built from multiple
  # sub-commands); the others don't. Normalize to exactly one before "bye"
  # so it's never "...;; bye".
  local cmd="$1"
  [[ "$cmd" == *";" ]] || cmd="$cmd;"
  lftp "${lftp_conn[@]}" -e "$cmd bye"
}

work_dir=$(mktemp -d)
readonly work_dir
trap 'rm -rf "$work_dir"' EXIT

build_local_manifest() {
  # -print0/-z/-0 so a filename containing whitespace can't desync xargs'
  # word-splitting.
  (cd "$DIST_DIR" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) >"$work_dir/new-manifest.txt"

  # An empty build would otherwise diff as "everything was deleted" and
  # wipe the whole remote target.
  if [[ ! -s "$work_dir/new-manifest.txt" ]]; then
    echo "$DIST_DIR contains no files; refusing to deploy (this would delete everything remote)" >&2
    exit 1
  fi

  sort -o "$work_dir/new-manifest.txt" "$work_dir/new-manifest.txt"
}

full_sync() {
  # .lftp_ignore holds paths this must never touch, notably preview/,
  # owned exclusively by preview_deploy.yml/preview_cleanup.yml. A pattern
  # with a single quote is a hard fail, not a skip: silently dropping an
  # exclude here could reintroduce the preview-wipe bug this replaced.
  local pattern exclude_flags=""
  if [[ -f ".lftp_ignore" ]]; then
    while IFS= read -r pattern; do
      [[ -z "$pattern" || "$pattern" == \#* ]] && continue
      if contains_single_quote "$pattern"; then
        echo ".lftp_ignore pattern must not contain a single quote: $pattern" >&2
        exit 1
      fi
      exclude_flags+=" -X '$pattern'"
    done <".lftp_ignore"
  fi

  run_lftp "mirror --reverse --delete --parallel=10 --verbose=1 ${exclude_flags} '$DIST_DIR/' '$REMOTE_ROOT/'"
  publish_manifest
  echo "Full sync complete."
}

fetch_remote_manifest() {
  # Absent on a brand new preview path or the first deploy under this
  # scheme, so treat everything as new then. Truncate explicitly on
  # failure rather than trust a possibly-partial file the failed get left.
  if ! run_lftp "get '$MANIFEST_REMOTE' -o '$work_dir/old-manifest.txt'"; then
    : >"$work_dir/old-manifest.txt"
  fi
  sort -o "$work_dir/old-manifest.txt" "$work_dir/old-manifest.txt"
}

compute_diff() {
  # sha256sum's format is a 64-char hash + " " + a mode flag + the
  # filename, so the filename always starts at column 67. Extracting by
  # that fixed offset, not whitespace-splitting, keeps a filename
  # containing a space intact.
  comm -13 "$work_dir/old-manifest.txt" "$work_dir/new-manifest.txt" \
    | cut -c 67- >"$work_dir/to_upload.txt"

  comm -23 \
    <(cut -c 67- "$work_dir/old-manifest.txt" | sort) \
    <(cut -c 67- "$work_dir/new-manifest.txt" | sort) \
    >"$work_dir/to_delete.txt"

  echo "Files to upload: $(wc -l <"$work_dir/to_upload.txt")"
  echo "Files to delete: $(wc -l <"$work_dir/to_delete.txt")"
}

delete_removed() {
  [[ -s "$work_dir/to_delete.txt" ]] || return 0

  # Runs before upload_changed so a path that changed kind between builds
  # (file <-> directory) doesn't collide with the stale remote entry.
  local rel
  local -a delete_cmds=()
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    if contains_single_quote "$rel"; then
      echo "::warning::Skipping delete of path containing a single quote: $rel" >&2
      continue
    fi
    delete_cmds+=("rm -f '$REMOTE_ROOT/${rel#./}';")
  done <"$work_dir/to_delete.txt"

  if ((${#delete_cmds[@]} > 0)); then
    # fail-exit no: a path may already be gone, which isn't fatal.
    run_lftp "set cmd:fail-exit no; ${delete_cmds[*]}" \
      || echo "::warning::Delete pass reported a failure; any files it didn't remove will be retried next deploy" >&2
  fi
}

upload_changed() {
  [[ -s "$work_dir/to_upload.txt" ]] || return 0

  # No --delete here: staging only the changed files means this pass
  # can't remove anything beyond what compute_diff identified.
  local rel
  local upload_dir="$work_dir/upload"
  mkdir -p "$upload_dir"
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    mkdir -p "$upload_dir/$(dirname "$rel")"
    cp "$DIST_DIR/$rel" "$upload_dir/$rel"
  done <"$work_dir/to_upload.txt"

  run_lftp "mirror --reverse --parallel=10 --verbose=1 '$upload_dir/' '$REMOTE_ROOT/'"
}

publish_manifest() {
  run_lftp "put '$work_dir/new-manifest.txt' -o '$MANIFEST_REMOTE'"
}

main() {
  build_local_manifest

  if [[ "$FULL_SYNC" == "true" ]]; then
    full_sync
    return
  fi

  fetch_remote_manifest
  compute_diff
  delete_removed
  upload_changed
  publish_manifest
  echo "Deploy complete."
}

main
