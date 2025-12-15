#!/bin/bash
# Deploy to Production Environment
# Usage: ./scripts/deploy-production.sh [commit-message]
# 
# IMPORTANT: Only run this after testing on staging!

set -e

echo "⚠️  DEPLOYING TO PRODUCTION ⚠️"
read -p "Have you tested this on staging? (yes/no): " confirmed

if [ "$confirmed" != "yes" ]; then
    echo "❌ Deployment cancelled. Please test on staging first."
    exit 1
fi

echo "🚀 Deploying to Production Environment..."

# Ensure we're on main branch
git checkout main

# Merge staging into main
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
else
    COMMIT_MSG="Deploy to production - $(date +%Y-%m-%d\ %H:%M:%S)"
fi

echo "📝 Merging staging into main..."
git merge staging --no-ff -m "$COMMIT_MSG"

# Tag the release
VERSION=$(node -p "require('./package.json').version")
TAG_NAME="v${VERSION}-$(date +%Y%m%d-%H%M%S)"
echo "🏷️  Creating release tag: $TAG_NAME"
git tag -a "$TAG_NAME" -m "Production release $VERSION"

echo "🚀 Pushing to production..."
git push origin main
git push origin "$TAG_NAME"

echo "✅ Production deployment initiated!"
echo "📊 Check Railway dashboard for deployment status"
echo "🌐 Production URL: https://airpodsupport.ljmuk.co.uk"


