# Deploy to Staging Environment (PowerShell)
# Usage: .\scripts\deploy-staging.ps1 [commit-message]

param(
    [string]$CommitMessage = "Deploy to staging - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "🚀 Deploying to Staging Environment..." -ForegroundColor Cyan

# Check if staging branch exists
$stagingExists = git show-ref --verify --quiet refs/heads/staging
if (-not $stagingExists) {
    Write-Host "📦 Creating staging branch..." -ForegroundColor Yellow
    git checkout -b staging
    git push -u origin staging
} else {
    Write-Host "✅ Staging branch exists" -ForegroundColor Green
    git checkout staging
}

Write-Host "📝 Merging changes..." -ForegroundColor Cyan
git merge main --no-ff -m $CommitMessage

Write-Host "🚀 Pushing to staging..." -ForegroundColor Cyan
git push origin staging

Write-Host "✅ Deployment initiated!" -ForegroundColor Green
Write-Host "📊 Check Railway dashboard for deployment status" -ForegroundColor Yellow
Write-Host "🌐 Staging URL: https://your-staging-url.railway.app" -ForegroundColor Yellow


