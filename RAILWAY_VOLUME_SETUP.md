# Railway Persistent Volume Setup Guide

This guide will help you set up persistent storage for uploaded photos on Railway.

## Why Persistent Volumes?

Railway's filesystem is ephemeral - files are deleted when the container restarts. Persistent volumes allow files to survive container restarts.

## Setup Steps

### 1. Create a Volume in Railway

1. Go to your Railway project dashboard
2. Click **"New"** → **"Volume"**
3. Name it something like `uploads-storage` or `product-photos`
4. Railway will create the volume and provide a mount path

### 2. Mount the Volume to Your Service

1. In your Railway project, select your **App service** (not the MongoDB service)
2. Go to the **"Settings"** tab
3. Scroll down to **"Volumes"** section
4. Click **"Add Volume"**
5. Select the volume you created
6. Set the **Mount Path** to: `/data` (or any path you prefer)

### 3. Set Environment Variable

1. Still in your App service settings, go to **"Variables"** tab
2. Add a new variable:
   - **Name:** `RAILWAY_VOLUME_MOUNT_PATH`
   - **Value:** `/data` (must match the mount path from step 2)

### 4. Redeploy

The app will automatically detect the volume and use it for uploads. You may need to redeploy:
- Railway usually auto-deploys on environment variable changes
- Or manually trigger a redeploy from the dashboard

## How It Works

- Photos will be stored in `/data/uploads/` on the persistent volume
- Files will survive container restarts
- The app automatically creates the uploads directory if it doesn't exist
- Existing code doesn't need changes - it just works!

## Verification

After setup, upload a photo through the admin panel. The photo should:
1. Upload successfully
2. Appear in the admin panel
3. Be visible to customers
4. **Survive a container restart** (this is the key benefit!)

## Troubleshooting

### Photos still disappearing after restart?
- Check that the volume is mounted: Railway dashboard → Your service → Settings → Volumes
- Verify the environment variable: `RAILWAY_VOLUME_MOUNT_PATH` is set correctly
- Check server logs for: "📦 Using Railway persistent volume for uploads"

### Volume not found?
- Make sure you created the volume first (New → Volume)
- Then mount it to your App service (not MongoDB service)
- The mount path must match the environment variable

### Want to use a different mount path?
- Change both the mount path in Railway AND the environment variable
- Common paths: `/data`, `/uploads`, `/storage`

## Cost

Railway Persistent Volumes are **included with your Railway plan** - no extra charge! This makes it the cheapest option.

## Alternative: Using `/data` as default

If you don't set `RAILWAY_VOLUME_MOUNT_PATH`, the app will use `public/uploads` which is ephemeral. Once you set the environment variable, it will automatically switch to the persistent volume.

