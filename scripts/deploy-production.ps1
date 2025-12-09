# Deploy to Production Environment (PowerShell)
# Usage: .\scripts\deploy-production.ps1 [commit-message]
# 
# IMPORTANT: Only run this after testing on staging!

param(
    [string]$CommitMessage = "Deploy to production - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "⚠️  DEPLOYING TO PRODUCTION ⚠️" -ForegroundColor Red
$confirmed = Read-Host "Have you tested this on staging? (yes/no)"

if ($confirmed -ne "yes") {
    Write-Host "❌ Deployment cancelled. Please test on staging first." -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Deploying to Production Environment..." -ForegroundColor Cyan

# Ensure we're on main branch
git checkout main

Write-Host "📝 Merging staging into main..." -ForegroundColor Cyan
git merge staging --no-ff -m $CommitMessage

# Tag the release
$packageJson = Get-Content package.json | ConvertFrom-Json
$version = $packageJson.version
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tagName = "v${version}-${timestamp}"

Write-Host "🏷️  Creating release tag: $tagName" -ForegroundColor Cyan
git tag -a $tagName -m "Production release $version"

Write-Host "🚀 Pushing to production..." -ForegroundColor Cyan
git push origin main
git push origin $tagName

Write-Host "✅ Production deployment initiated!" -ForegroundColor Green
Write-Host "📊 Check Railway dashboard for deployment status" -ForegroundColor Yellow
Write-Host "🌐 Production URL: https://airpodsupport.ljmuk.co.uk" -ForegroundColor Yellow

