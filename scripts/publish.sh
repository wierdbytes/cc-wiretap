#!/usr/bin/env bash
#
# publish.sh — publish the `cc-wiretap` npm package (packages/proxy).
#
# Modelled after autosk's `scripts/publish-extensions.sh`: version-gated, so a
# repo whose package version is already live on npm is a no-op. That makes it
# safe to run on EVERY green push to `main` (see .github/workflows/publish.yml):
# only a push that actually bumped the version publishes anything.
#
# Prerequisites:
#   - publish rights to the `cc-wiretap` package on npmjs.com.
#   - locally: `npm login`; in CI: OIDC trusted publishing (no token — the
#     workflow's `id-token: write` permission supplies a short-lived credential;
#     configure the trusted publisher on the package's npmjs.com settings page:
#     GitHub Actions, repo `wierdbytes/cc-wiretap`, workflow `publish.yml`).
#   - bump `packages/proxy/package.json` (the CLI banner/`--version` read it via
#     a bundled import, so no other file needs syncing) before re-publishing; a
#     version that is already on npm is skipped automatically.
#
# Usage:
#   scripts/publish.sh            # DRY RUN (npm publish --dry-run)
#   scripts/publish.sh --publish  # actually publish
#   OTP=123456 scripts/publish.sh --publish   # with 2FA one-time code
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
npm_bin="${NPM:-npm}"
pnpm_bin="${PNPM:-pnpm}"

mode="dry"
for arg in "$@"; do
  case "$arg" in
    --dry-run) mode="dry" ;;
    --publish) mode="publish" ;;
    *) echo "usage: publish.sh [--dry-run|--publish]" >&2; exit 2 ;;
  esac
done

command -v "$npm_bin"  >/dev/null 2>&1 || { echo "publish: npm not found on PATH" >&2; exit 1; }
command -v "$pnpm_bin" >/dev/null 2>&1 || { echo "publish: pnpm not found on PATH" >&2; exit 1; }

# registry_has_version <name> <version> — true when that EXACT version is already
# published on npm. Used to skip a package whose repo version is already live
# (otherwise `npm publish` aborts with "cannot publish over the previously
# published versions"). A never-published / unknown version 404s → empty output
# → treated as not-present, so we proceed (offline 404s behave the same, and the
# publish step then surfaces the real error).
registry_has_version() {
  local name="$1" ver="$2" out
  out="$("$npm_bin" view "$name@$ver" version 2>/dev/null || true)"
  [ "$(printf '%s' "$out" | tr -d '[:space:]')" = "$ver" ]
}

# The single published package. `packages/ui` is workspace-only (private) and is
# bundled into the proxy's `dist/ui` at build time.
packages=(
  "packages/proxy"
)

echo "== sanity: pnpm install + build + test =="
( cd "$repo_root" && "$pnpm_bin" install --frozen-lockfile >/dev/null 2>&1 || "$pnpm_bin" install >/dev/null )
( cd "$repo_root" && "$pnpm_bin" run build )
( cd "$repo_root" && "$pnpm_bin" --filter @cc-wiretap/ui run test )

otp_args=()
[ -n "${OTP:-}" ] && otp_args=(--otp "$OTP")

for rel in "${packages[@]}"; do
  dir="$repo_root/$rel"
  name="$(cd "$dir" && node -p "require('./package.json').name" 2>/dev/null || echo "$rel")"
  ver="$(cd "$dir" && node -p "require('./package.json').version" 2>/dev/null || echo "?")"
  if registry_has_version "$name" "$ver"; then
    echo "== skip: $name@$ver already on npm ($rel) =="
    continue
  fi
  if [ "$mode" = "dry" ]; then
    echo "== DRY RUN: $name@$ver ($rel) =="
    ( cd "$dir" && "$npm_bin" publish --access public --dry-run )
  else
    echo "== publish: $name@$ver ($rel) =="
    ( cd "$dir" && "$npm_bin" publish --access public "${otp_args[@]}" )
  fi
done

if [ "$mode" = "dry" ]; then
  echo
  echo "DRY RUN complete. Re-run with --publish to actually publish (needs \`npm login\`"
  echo "locally; CI uses OIDC trusted publishing — see .github/workflows/publish.yml)."
else
  echo
  echo "Published. Install with: npx cc-wiretap (or npm i -g cc-wiretap)."
fi
