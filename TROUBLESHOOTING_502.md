# Troubleshooting 502 Bad Gateway Error

## Issue
Getting 502 Bad Gateway error when trying to log in with legacy credentials.

## Possible Causes

1. **Server is down or crashed** - Check Railway deployment logs
2. **Session middleware not configured** - Session might not be initialized
3. **Database connection issues** - MongoDB connection might be failing
4. **Environment variables missing** - `ADMIN_USERNAME` or `ADMIN_PASSWORD` not set

## Quick Fixes

### 1. Check Railway Deployment Status

1. Go to Railway Dashboard
2. Select AirPod Support Tracking Portal project
3. Check **Deployments** tab - is the latest deployment successful?
4. Check **Logs** tab - are there any errors?

### 2. Verify Environment Variables

In Railway Dashboard → Variables tab, ensure you have:
- `ADMIN_USERNAME` - Your username (default: `admin`)
- `ADMIN_PASSWORD` - Your password
- `SESSION_SECRET` - Session secret key (optional, has default)

### 3. Check Server Health

Try accessing:
- `https://airpodsupport.ljmuk.co.uk/health` (if exists)
- `https://airpodsupport.ljmuk.co.uk/` (root endpoint)

### 4. Use User Service Login Instead

If legacy login isn't working, use the "Login with User Service" button:
1. Click "Login with User Service" button
2. Use your master account credentials from User Service
3. This should work even if legacy login is broken

## Alternative: Direct Database Access

If you need immediate access to your products:

1. **Connect to MongoDB directly** (via Railway MongoDB service)
2. **Export your products** using MongoDB tools
3. **Access via MongoDB Compass** or similar tool

## Next Steps

1. Check Railway logs for errors
2. Verify environment variables are set
3. Try redeploying the service
4. Use User Service login as a workaround

