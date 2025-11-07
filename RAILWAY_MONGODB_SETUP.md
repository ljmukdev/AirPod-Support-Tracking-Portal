# Railway MongoDB Connection Setup

## The Problem
Railway is providing MongoDB connection variables in template format that aren't being resolved.

## Solution

### Check Your Railway Environment Variables

1. **Go to Railway Dashboard** → Your Project → Variables

2. **Check what variables are actually set:**
   - Look for variables starting with `MONGO`
   - The actual variable names might be different

### Railway MongoDB Service Reference

If you're using Railway's MongoDB service reference, the syntax should be:

```
MONGO_URL=${{AutoRestockDB.MONGO_URL}}
```

But sometimes Railway uses different variable names. Check:

1. **In Railway Dashboard:**
   - Go to your MongoDB service
   - Click "Variables" tab
   - Look for the actual connection string variable name

2. **Common Railway MongoDB Variable Names:**
   - `MONGO_URL`
   - `MONGODB_URI`
   - `MONGO_PUBLIC_URL`
   - Or individual components:
     - `MONGOUSER`
     - `MONGOPASSWORD`
     - `MONGOHOST`
     - `MONGOPORT`
     - `MONGODATABASE`

### Quick Fix

1. **Option A: Use the full connection string**
   - In Railway MongoDB service, find the connection string
   - Copy it directly
   - Set `MONGODB_URI` in your app's environment variables to that full string

2. **Option B: Use Railway's service reference**
   - Make sure your app service is connected to the MongoDB service
   - Railway should auto-inject the connection variables
   - Use the exact variable name Railway provides

3. **Check Logs:**
   - After deploying, check Railway logs
   - The new code will show what MongoDB variables are available
   - Look for: "Available environment variables:"

### Expected Format

The MongoDB connection string should look like:
```
mongodb://username:password@host:port/database?authSource=admin
```

Or for Railway:
```
mongodb://mongo:password@host.railway.internal:27017/railway
```



