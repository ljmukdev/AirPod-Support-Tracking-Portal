# PowerShell script to merge feature branch to main

Write-Host "Fetching latest changes..." -ForegroundColor Cyan
git fetch origin main

Write-Host "Switching to main branch..." -ForegroundColor Cyan
git checkout main

Write-Host "Pulling latest main..." -ForegroundColor Cyan
git pull origin main

Write-Host "Merging feature branch..." -ForegroundColor Cyan
git merge claude/serial-number-uniqueness-question-01NLnxFBDr2bWcNDAuSEAjvB

Write-Host "Pushing to main..." -ForegroundColor Cyan
git push origin main

Write-Host "✅ Merge complete!" -ForegroundColor Green
