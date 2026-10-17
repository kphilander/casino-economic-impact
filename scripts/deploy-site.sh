#!/usr/bin/env bash
# ============================================================================
# Stage a deploy of the calculator to gamblingpolicy.com
# ============================================================================
#
# The hosted calculator is a committed build in the kphilander/gamblingpolicy.com
# repository (public/tools/economic-impact/). Netlify deploys that repository
# when its main branch changes.
#
# This script builds the calculator from a clean checkout of origin/main of
# this repository (never from a working tree), runs the tests, replaces the
# snapshot in a gamblingpolicy.com clone on a new branch, and commits it. Push
# the branch and open a pull request; merging the pull request deploys.
#
# Usage: scripts/deploy-site.sh [path to gamblingpolicy.com clone]
#        (default: ../gamblingpolicy.com next to this repository)
# ============================================================================

set -euo pipefail

APP=$(cd "$(dirname "$0")/.." && pwd)
SITE=$(cd "${1:-$APP/../gamblingpolicy.com}" && pwd)
TARGET=public/tools/economic-impact

if [ -n "$(git -C "$SITE" status --porcelain)" ]; then
  echo "The site clone $SITE has uncommitted changes. Commit or remove them first." >&2
  exit 1
fi

git -C "$APP" fetch -q origin main
WORK=$(mktemp -d)
git -C "$APP" worktree add -q --detach "$WORK" origin/main
trap 'git -C "$APP" worktree remove --force "$WORK"' EXIT
SHA=$(git -C "$WORK" rev-parse --short HEAD)
echo "Building the calculator from origin/main ($SHA)"

(
  cd "$WORK/webapp"
  npm ci --no-audit --no-fund
  npm test
  npm run build
)
if ! grep -q "$SHA" "$WORK"/webapp/dist/assets/index-*.js; then
  echo "The build does not carry commit $SHA. Stopping." >&2
  exit 1
fi

git -C "$SITE" fetch -q origin main
BRANCH="gems-deploy-$SHA"
git -C "$SITE" checkout -q -B "$BRANCH" origin/main
rm -rf "${SITE:?}/$TARGET"
cp -R "$WORK/webapp/dist" "$SITE/$TARGET"
git -C "$SITE" add -A "$TARGET"
if git -C "$SITE" diff --cached --quiet; then
  echo "The site already has this build. Nothing to deploy."
  exit 0
fi
git -C "$SITE" commit -q -m "Deploy the GEMS calculator from casino-economic-impact $SHA" \
  -m "Build of kphilander/casino-economic-impact origin/main at $SHA, made by scripts/deploy-site.sh."

echo "Committed $TARGET on branch $BRANCH in $SITE."
echo "Next: git -C \"$SITE\" push -u origin $BRANCH, open a pull request, check the Netlify deploy preview, then merge to deploy."
