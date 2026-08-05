#!/usr/bin/env bash
#
# Bootstrap the azure-app deployable by copying parent-app files in.
#
# azure-app/ is intentionally NOT a full copy of the parent app. Only
# the ~15 files that are new or genuinely override parent behaviour
# are git-tracked here (see .gitignore). Everything else (the ~34,000
# lines of pages, components, migrations, translations) lives once in
# the parent app and gets copied in on demand.
#
# Run this once after checkout, then again after any parent-app change
# you want to pick up:
#
#   cd azure-app
#   bash bootstrap.sh          # copies parent files in
#   npm install
#   npm run dev                # http://localhost:3100
#
# Uses `cp -Rn` (no-clobber) so the git-tracked overrides in azure-app/
# are never overwritten by the parent copies.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT="$(cd "$HERE/.." && pwd)"

if [ ! -d "$PARENT/app" ] || [ ! -f "$PARENT/package.json" ]; then
  echo "✗ Could not find parent app at $PARENT. Run this from azure-app/." >&2
  exit 1
fi

echo "▸ Bootstrapping azure-app from $PARENT"

# Recursively copy parent trees using cp -R with no-clobber (-n).
# The -n means we never overwrite an existing file, so our overrides
# stay intact. Some cp variants ignore -n when the target dir exists,
# so we walk file-by-file to be portable.
copy_tree() {
  local src="$1"
  local dst="$2"
  [ -d "$src" ] || return 0
  # find + install-style loop: one file at a time.
  ( cd "$src" && find . -type f ) | while read rel; do
    local target="$dst/${rel#./}"
    if [ ! -e "$target" ]; then
      mkdir -p "$(dirname "$target")"
      cp "$src/${rel#./}" "$target"
    fi
  done
}

# Directory trees.
for d in app components lib messages public tests; do
  copy_tree "$PARENT/$d" "$HERE/$d"
done

# Supabase migrations (parent has 001–059; azure-app owns 060).
copy_tree "$PARENT/supabase/migrations" "$HERE/supabase/migrations"

# Loose supabase/*.sql files (seed data) — useful for dev/UAT reset.
mkdir -p "$HERE/supabase"
for f in "$PARENT"/supabase/*.sql; do
  [ -f "$f" ] || continue
  target="$HERE/supabase/$(basename "$f")"
  [ -e "$target" ] || cp "$f" "$target"
done

# Loose parent-root files needed by Next.js.
for f in middleware.ts tailwind.config.ts next-env.d.ts vitest.config.ts; do
  if [ -f "$PARENT/$f" ] && [ ! -f "$HERE/$f" ]; then
    cp "$PARENT/$f" "$HERE/$f"
  fi
done

echo "✓ azure-app is now a full Next.js project."
echo "  Next steps: npm install && npm run dev"
