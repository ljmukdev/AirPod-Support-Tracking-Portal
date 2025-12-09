# Staging Environment Setup Guide

This guide explains how to use the staging environment for testing before deploying to production.

## Overview

We use a **branch-based deployment strategy**:
- **`main` branch** → **Production** (live site)
- **`staging` branch** → **Staging** (testing environment)

## Railway Setup

### Step 1: Create Staging Service in Railway

1. Go to Railway Dashboard → Your Project
2. Click **"New"** → **"Service"** → **"GitHub Repo"**
3. Select the same repository: `ljmukdev/AirPod-Support-Tracking-Portal`
4. Name it: **"AirPod Support - Staging"**
5. In the service settings, go to **"Settings"** → **"Source"**
6. Set **"Branch"** to: `staging`
7. Railway will automatically deploy from the `staging` branch

### Step 2: Create Staging MongoDB Database

1. In Railway Dashboard, add a new **MongoDB** service
2. Name it: **"MongoDB Staging"** or **"AutoRestockDB-Staging"**
3. Connect it to your **Staging** app service
4. Railway will auto-inject MongoDB connection variables

### Step 3: Configure Staging Environment Variables

In your **Staging** app service → **Variables** tab, set:

```
NODE_ENV=staging
ADMIN_USERNAME=admin_staging
ADMIN_PASSWORD=your_staging_password
SESSION_SECRET=your_staging_session_secret
```

**MongoDB Variables** (use Railway Service Reference):
- `MONGOUSER` → Reference from MongoDB Staging service
- `MONGOPASSWORD` → Reference from MongoDB Staging service  
- `MONGOHOST` → Reference from MongoDB Staging service
- `MONGOPORT` → `27017`
- `MONGODATABASE` → `AutoRestockDB-Staging`

**Optional - Staging-specific:**
- `SMTP_HOST` → Use test email service (optional)
- `STRIPE_SECRET_KEY` → Use Stripe test keys (optional)

### Step 4: Set Up Custom Domain (Optional)

1. In Staging service → **Settings** → **Domains**
2. Add a subdomain: `staging.airpodsupport.ljmuk.co.uk`
3. Configure DNS as instructed by Railway

## Git Workflow

### Creating the Staging Branch

```bash
# Create and switch to staging branch
git checkout -b staging

# Push staging branch to GitHub
git push -u origin staging
```

### Development Workflow

1. **Make changes** on a feature branch or directly on `staging`
2. **Test on staging:**
   ```bash
   git checkout staging
   git merge your-feature-branch  # or commit directly
   git push origin staging
   ```
3. **Railway automatically deploys** staging branch to staging environment
4. **Test thoroughly** on staging URL
5. **When ready for production:**
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```
6. **Railway automatically deploys** main branch to production

### Quick Commands

```bash
# Deploy to staging
git checkout staging
git merge main  # or your feature branch
git push origin staging

# Deploy to production (after testing)
git checkout main
git merge staging
git push origin main
```

## Environment Detection

The app automatically detects the environment:
- `NODE_ENV=staging` → Shows "STAGING" banner, uses staging database
- `NODE_ENV=production` → Production mode, uses production database
- Default → Development mode

## Testing Checklist

Before merging to production, test on staging:

- [ ] App starts without errors
- [ ] Database connection works
- [ ] Admin login works
- [ ] Product management works
- [ ] Warranty registration flow works
- [ ] Payment flow works (if applicable)
- [ ] Email sending works (if applicable)
- [ ] Analytics tracking works
- [ ] All API endpoints respond correctly

## Rollback Procedure

If staging has issues:

```bash
# Revert staging to last known good commit
git checkout staging
git reset --hard <last-good-commit-hash>
git push origin staging --force
```

If production has issues:

```bash
# Revert production to previous version
git checkout main
git reset --hard <previous-version-hash>
git push origin main --force
```

## Best Practices

1. **Always test on staging first** before deploying to production
2. **Keep staging database separate** from production
3. **Use test payment keys** in staging (Stripe test mode)
4. **Monitor staging logs** for errors before promoting
5. **Tag releases** when deploying to production:
   ```bash
   git tag -a v1.2.6 -m "Release version 1.2.6"
   git push origin v1.2.6
   ```

## Troubleshooting

### Staging not deploying
- Check Railway service is set to `staging` branch
- Verify branch exists: `git branch -a`
- Check Railway build logs

### Database connection issues
- Verify MongoDB service is connected to staging app
- Check environment variables are set correctly
- Ensure MongoDB service is running

### Environment variables not working
- Railway service references need to be set up in dashboard
- Check variable names match exactly
- Verify no typos or extra spaces

