# Deployment Workflow - Quick Reference

## 🚀 Quick Deploy Commands

### Deploy to Staging (Test Environment)
```powershell
npm run deploy:staging
# OR manually:
git checkout staging
git merge main
git push origin staging
```

### Deploy to Production (Live Site)
```powershell
npm run deploy:production
# OR manually:
git checkout main
git merge staging
git push origin main
```

## 📋 Standard Workflow

1. **Make changes** on a feature branch or directly on `staging`
2. **Deploy to staging:**
   ```powershell
   git checkout staging
   git merge your-feature-branch
   git push origin staging
   ```
3. **Test on staging URL** (Railway will auto-deploy)
4. **When ready, deploy to production:**
   ```powershell
   git checkout main
   git merge staging
   git push origin main
   ```

## 🌍 Environments

- **Staging**: `staging` branch → Test environment
- **Production**: `main` branch → Live site (airpodsupport.ljmuk.co.uk)

## ⚠️ Important Notes

- **Always test on staging first** before deploying to production
- Staging has a **orange banner** at the top to indicate it's a test environment
- Staging uses a **separate database** from production
- Production deployments are **automatically tagged** with version numbers

## 🔧 Railway Setup

### Staging Service
- Branch: `staging`
- Environment: `NODE_ENV=staging`
- Database: Separate MongoDB instance

### Production Service  
- Branch: `main`
- Environment: `NODE_ENV=production`
- Database: Production MongoDB instance

See `STAGING_SETUP.md` for detailed setup instructions.


