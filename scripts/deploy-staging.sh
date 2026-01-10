#!/bin/bash
# Deploy to Staging Environment
# Usage: ./scripts/deploy-staging.sh [commit-message]

set -e

echo "🚀 Deploying to Staging Environment..."

# Check if staging branch exists
if ! git show-ref --verify --quiet refs/heads/staging; then
    echo "📦 Creating staging branch..."
    git checkout -b staging
    git push -u origin staging
else
    echo "✅ Staging branch exists"
    git checkout staging
fi

# Merge main into staging (or current branch)
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
else
    COMMIT_MSG="Deploy to staging - $(date +%Y-%m-%d\ %H:%M:%S)"
fi

echo "📝 Merging changes..."
git merge main --no-ff -m "$COMMIT_MSG"

echo "🚀 Pushing to staging..."
git push origin staging

echo "✅ Deployment initiated!"
echo "📊 Check Railway dashboard for deployment status"
echo "🌐 Staging URL: https://your-staging-url.railway.app"


