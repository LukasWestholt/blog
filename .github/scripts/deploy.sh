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
# unconditional `mirror --delete` of dist/ onto REMOTE_ROOT: every file is
# re-uploaded, and anything remote that isn't in dist/ is removed,
# regardless of what the manifest says. This is the only way to fix drift
# the manifest doesn't know about (files changed or added outside of a
# deploy), so it's meant as a deliberate disaster-recovery action, not the
# routine deploy path.

DIST_DIR="${DIST_DIR:-dist}"
readonly DIST_DIR
REMOTE_ROOT="${REMOTE_ROOT:?REMOTE_ROOT is required}"
FULL_SYNC="${FULL_SYNC:-false}"
readonly FULL_SYNC

###############################################################################
# Returns success if the given value contains a single quote.
#
# Every value below gets embedded, single-quoted, inside an lftp -e command
# string. lftp's own quoting/escaping rules for its command language aren't
# reliably documented, so rather than trying to escape a literal single
# quote correctly, callers refuse to use a value this returns true for.
###############################################################################
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

# Collapse any run of repeated slashes into one. A caller joining an
# already "/"-rooted value (e.g. SERVER_TARGET=/) with "/preview/<branch>/"
# produces a literal "//preview/...", which is well-defined behavior on
# some systems but not something to depend on. Then strip a trailing
# slash so REMOTE_ROOT is canonically slash-free from here on. Call sites
# that need a trailing slash add it back explicitly.
REMOTE_ROOT=$(printf '%s' "$REMOTE_ROOT" | sed -E 's#/+#/#g')
REMOTE_ROOT="${REMOTE_ROOT%/}"
readonly REMOTE_ROOT

readonly MANIFEST_REMOTE="$REMOTE_ROOT/.deploy-manifest.txt"

# Credentials via -u/-p rather than embedded in an sftp:// URL: SFTP_PASS
# is an opaque secret we don't control the character set of, and a
# URL-embedded password containing '@', ':' or '/' would be misparsed.
readonly lftp_conn=(-u "${SFTP_USER},${SFTP_PASS}" -p "$SFTP_PORT" "sftp://${SFTP_HOST}")

run_lftp() {
  # Normalize to exactly one trailing ";" before "bye" regardless of
  # whether the caller's command already ends in one (delete_removed's
  # command does, since it's built from multiple ";"-terminated
  # sub-commands; the others don't). Appending unconditionally would
  # produce "...;; bye" in the former case.
  local cmd="$1"
  [[ "$cmd" == *";" ]] || cmd="$cmd;"
  lftp "${lftp_conn[@]}" -e "$cmd bye"
}

work_dir=$(mktemp -d)
readonly work_dir
trap 'rm -rf "$work_dir"' EXIT

###############################################################################
# Builds a sha256 manifest of the freshly built dist/ at
# $work_dir/new-manifest.txt, sorted and ready to diff or publish.
#
# -print0/-z/-0 throughout so a filename containing whitespace can't desync
# xargs' word-splitting (which would otherwise pass fragments of the name
# to sha256sum as separate, nonexistent paths).
#
# Refuses to continue if the build produced zero files (partial/failed
# build, wrong DIST_DIR): that would otherwise diff as "every
# previously-deployed file was deleted" and wipe the whole remote target.
###############################################################################
build_local_manifest() {
  (cd "$DIST_DIR" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) >"$work_dir/new-manifest.txt"

  if [[ ! -s "$work_dir/new-manifest.txt" ]]; then
    echo "$DIST_DIR contains no files; refusing to deploy (this would delete everything remote)" >&2
    exit 1
  fi

  sort -o "$work_dir/new-manifest.txt" "$work_dir/new-manifest.txt"
}

###############################################################################
# Unconditional mirror --delete of dist/ onto REMOTE_ROOT, ignoring the
# manifest diff entirely. See the FULL_SYNC doc comment at the top of this
# file for why this mode exists.
###############################################################################
full_sync() {
  # .lftp_ignore holds paths this script must never touch even in a full
  # sync, notably preview/, which is owned exclusively by
  # preview_deploy.yml/preview_cleanup.yml. Without this, a production
  # full sync (dist/ never contains a preview/ dir) would delete every
  # open PR's preview, the exact bug this manifest scheme replaced. A
  # pattern containing a single quote is refused outright rather than
  # skipped: silently dropping an exclude here could reintroduce that
  # exact bug, so this is treated as a config error worth failing loudly
  # on, not a best-effort skip.
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

###############################################################################
# Fetches the manifest of the last deploy into $work_dir/old-manifest.txt,
# sorted and ready to diff. Absent on a brand new preview path or the very
# first deploy under this scheme, so treat everything as new then --
# truncated explicitly on failure rather than relying on the (possibly
# partial) file lftp's failed get may have left behind.
###############################################################################
fetch_remote_manifest() {
  if ! run_lftp "get '$MANIFEST_REMOTE' -o '$work_dir/old-manifest.txt'"; then
    : >"$work_dir/old-manifest.txt"
  fi
  sort -o "$work_dir/old-manifest.txt" "$work_dir/old-manifest.txt"
}

###############################################################################
# Diffs old vs. new manifests into $work_dir/to_upload.txt and
# $work_dir/to_delete.txt.
#
# Files whose "<hash>  <path>" line is new (new path, or same path with a
# changed hash) need uploading; files whose path disappeared need
# deleting. Paths are extracted by fixed column offset (sha256sum's format
# is a 64-char hex digest + " " + a mode flag + the filename, i.e. the
# filename always starts at column 67) rather than by whitespace-splitting,
# which would truncate any filename containing a space at its first space.
###############################################################################
compute_diff() {
  comm -13 "$work_dir/old-manifest.txt" "$work_dir/new-manifest.txt" \
    | cut -c 67- >"$work_dir/to_upload.txt"

  comm -23 \
    <(cut -c 67- "$work_dir/old-manifest.txt" | sort) \
    <(cut -c 67- "$work_dir/new-manifest.txt" | sort) \
    >"$work_dir/to_delete.txt"

  echo "Files to upload: $(wc -l <"$work_dir/to_upload.txt")"
  echo "Files to delete: $(wc -l <"$work_dir/to_delete.txt")"
}

###############################################################################
# Removes files that dropped out of the build, before anything is
# uploaded. Doing this first (rather than after the upload) means a path
# that changed kind between builds (was a file, now a directory, or vice
# versa) doesn't collide with the stale entry still sitting on the remote.
#
# Best-effort: a path may already be gone, which isn't fatal, so
# individual failures here don't abort the job. Paths containing a single
# quote are skipped (with a warning) rather than embedded unescaped --
# unlike the .lftp_ignore case above, silently skipping one stale file is
# low-stakes, so this doesn't need to fail the whole deploy.
###############################################################################
delete_removed() {
  [[ -s "$work_dir/to_delete.txt" ]] || return 0

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
    run_lftp "set cmd:fail-exit no; ${delete_cmds[*]}" \
      || echo "::warning::Delete pass reported a failure; any files it didn't remove will be retried next deploy" >&2
  fi
}

###############################################################################
# Stages changed/added files in a pruned tree that mirrors their paths,
# then uploads just that pruned tree. No --delete here: this pass must
# never remove anything beyond what compute_diff explicitly identified.
###############################################################################
upload_changed() {
  [[ -s "$work_dir/to_upload.txt" ]] || return 0

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

# Publishes the new manifest so the next deploy diffs against reality.
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
