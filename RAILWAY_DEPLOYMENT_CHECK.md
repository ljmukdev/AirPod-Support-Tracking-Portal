# Railway Deployment Troubleshooting Guide

## Quick Check: Is Railway Auto-Deploying?

### Step 1: Verify Changes Are on GitHub
✅ **CONFIRMED**: All changes are pushed to GitHub
- Latest commit: `2365d5b` - "Remove display:none from billing address section"
- Repository: `https://github.com/ljmukdev/AirPod-Support-Tracking-Portal.git`
- Branch: `main`

### Step 2: Check Railway Deployment Status

1. **Go to Railway Dashboard**: https://railway.app
2. **Open your project**: "AirPod Support & Tracking Portal"
3. **Click on "Deployments" tab** (left sidebar)
4. **Check the latest deployment**:
   - Look for commit `2365d5b` or "Remove display:none from billing address section"
   - Check deployment status: Should be "Active" (green) or "Building" (yellow)
   - Check deployment time: Should be recent (within last 10 minutes)

### Step 3: If Deployment is Missing or Old

**Manual Redeploy:**
1. In Railway dashboard, go to your **service** (the one running Node.js)
2. Click the **"..." menu** (three dots) in the top right
3. Select **"Redeploy"**
4. Railway will pull the latest code from GitHub and redeploy

**OR**

1. Go to **Settings** → **Source**
2. Click **"Redeploy"** button
3. This will trigger a fresh deployment from GitHub

### Step 4: Check Railway Logs

1. In Railway dashboard, click on your **service**
2. Go to **"Logs" tab**
3. Look for:
   - `✅ Connected to MongoDB successfully`
   - `LJM AirPod Support Server running on...`
   - Any errors or warnings

### Step 5: Verify GitHub Connection

1. In Railway dashboard → **Settings** → **Source**
2. Verify:
   - Repository: `ljmukdev/AirPod-Support-Tracking-Portal`
   - Branch: `main`
   - Auto Deploy: Should be **Enabled**

### Step 6: After Redeploy - Clear Browser Cache

1. **Hard Refresh**: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. **Or use Incognito/Private mode**: `Ctrl + Shift + N` (Windows) or `Cmd + Shift + N` (Mac)

## What Should Be Visible After Deployment

1. **Version Number**: `v1.2.0.001` in top-right corner of ALL pages
2. **Billing Address Section**: Should appear in warranty registration form (no `display: none`)
3. **Process Payment Button**: Should appear when extended warranty is selected

## Still Not Working?

Check these in Railway:
- Is the service **Active** (not paused)?
- Are there any **errors** in the logs?
- Is the **environment** set to `production`?
- Check **Variables** tab - are all required variables set?

