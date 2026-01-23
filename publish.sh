#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Building all packages..."
pnpm build

cd packages/proxy

echo ""
echo "Current version: $(node -p "require('./package.json').version")"
echo ""

read -p "Bump version (major.minor.patch) [patch]: " BUMP
BUMP=${BUMP:-patch}

npm version $BUMP
NEW_VERSION=$(node -p "require('./package.json').version")

# Update VERSION in index.ts
sed -i '' "s/const VERSION = \".*\"/const VERSION = \"$NEW_VERSION\"/" src/index.ts

# Update root package.json version
cd ../..
npm version $NEW_VERSION --no-git-tag-version
cd packages/proxy

echo ""
echo "Rebuilding with new version..."
pnpm build

npm publish --access public

# Commit version bump and create git tag
cd ../..
git add -A
git commit -m "Release v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo ""
echo "Published cc-wiretap@$NEW_VERSION"
echo "Created git tag v$NEW_VERSION"
echo ""
echo "Don't forget to push: git push && git push --tags"
