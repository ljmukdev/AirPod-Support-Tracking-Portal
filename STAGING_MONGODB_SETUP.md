# MongoDB Setup for Staging Environment

## Quick Setup Guide

### Step 1: Add MongoDB Service to Your Staging Project

1. **Go to Railway Dashboard** → https://railway.app
2. **Select your Staging project** (or create one if you don't have it)
3. **Click "+ New"** → **"Database"** → **"MongoDB"**
4. Railway will create a MongoDB service automatically
5. **Note the service name** (e.g., "MongoDB" or "mongodb")

### Step 2: Connect MongoDB to Your Staging App

**Option A: Use Railway Service References (Recommended)**

1. **Go to your Staging App Service** → **Variables** tab
2. **Click "New Variable"**
3. **Click the "Reference" tab** (not "Raw")
4. **Select your MongoDB service** from the dropdown
5. **Add these variable references:**

   | Variable Name | Reference From | Reference Variable |
   |--------------|---------------|-------------------|
   | `MONGOUSER` | MongoDB Service | `MONGO_INITDB_ROOT_USERNAME` |
   | `MONGOPASSWORD` | MongoDB Service | `MONGO_INITDB_ROOT_PASSWORD` |
   | `MONGOHOST` | MongoDB Service | `RAILWAY_PRIVATE_DOMAIN` |
   | `MONGOPORT` | (Manual) | `27017` |
   | `MONGODATABASE` | (Manual) | `AutoRestockDB` |

6. **For MONGOPORT and MONGODATABASE:** Click "Raw" tab and enter:
   - `MONGOPORT` = `27017`
   - `MONGODATABASE` = `AutoRestockDB`

**Option B: Manual Setup (If References Don't Work)**

1. **Go to MongoDB Service** → **Variables** tab
2. **Copy these values:**
   - `MONGO_INITDB_ROOT_USERNAME` (usually `mongo`)
   - `MONGO_INITDB_ROOT_PASSWORD` (copy the exact password)
   - `RAILWAY_PRIVATE_DOMAIN` (e.g., `mongodb.railway.internal`)

3. **Go to Staging App Service** → **Variables** tab
4. **Add these variables manually:**

   ```
   MONGOUSER = mongo
   MONGOPASSWORD = (paste exact password from MongoDB service)
   MONGOHOST = (paste RAILWAY_PRIVATE_DOMAIN from MongoDB service)
   MONGOPORT = 27017
   MONGODATABASE = AutoRestockDB
   ```

   ⚠️ **Important:**
   - No quotes around values
   - No extra spaces
   - Copy-paste password exactly (no typos)

### Step 3: Set Staging Environment Variable

1. **In your Staging App Service** → **Variables** tab
2. **Add/Update:**
   ```
   NODE_ENV = staging
   ```

### Step 4: Verify Connection

1. **Railway will automatically redeploy** when you save variables
2. **Check the logs** in your Staging App Service
3. **Look for:**
   ```
   ✅ Connected to MongoDB successfully using authSource: admin (standard)
   Database indexes created
   ```

4. **If you see errors**, check:
   - All variables are set correctly
   - No typos in password
   - MongoDB service is running (green status)

### Step 5: Test Analytics Page

1. **Visit your staging analytics page:**
   ```
   https://your-staging-app.railway.app/admin/analytics.html
   ```

2. **Login with admin credentials:**
   - Username: `admin`
   - Password: `LJM2024secure` (or your custom password)

3. **The database error should be gone** and analytics should load

## Troubleshooting

### Error: "Database not available"

**Possible causes:**
1. MongoDB service not connected to app
2. Environment variables not set correctly
3. MongoDB service not running

**Fix:**
- Verify MongoDB service is running (green status in Railway)
- Double-check all environment variables match exactly
- Check Railway logs for connection errors

### Error: "Authentication failed"

**Possible causes:**
1. Wrong username/password
2. Extra spaces in password
3. Password has special characters that need encoding

**Fix:**
- Copy password directly from MongoDB service variables
- Ensure no quotes or spaces around values
- Verify `MONGOUSER` matches `MONGO_INITDB_ROOT_USERNAME`

### Error: "getaddrinfo ENOTFOUND"

**Possible causes:**
1. `MONGOHOST` not set
2. Using public URL instead of private domain

**Fix:**
- Use `RAILWAY_PRIVATE_DOMAIN` from MongoDB service (not public URL)
- Should look like: `mongodb.railway.internal` or similar
- Never use public MongoDB URLs for internal connections

## Separate Databases for Staging vs Production

If you want separate databases:

1. **Staging App:**
   ```
   MONGODATABASE = AutoRestockDB_Staging
   ```

2. **Production App:**
   ```
   MONGODATABASE = AutoRestockDB
   ```

This keeps your staging and production data separate.

## Quick Checklist

- [ ] MongoDB service added to staging project
- [ ] MongoDB service is running (green status)
- [ ] `MONGOUSER` variable set (via reference or manual)
- [ ] `MONGOPASSWORD` variable set (via reference or manual)
- [ ] `MONGOHOST` variable set to private domain
- [ ] `MONGOPORT` set to `27017`
- [ ] `MONGODATABASE` set to `AutoRestockDB`
- [ ] `NODE_ENV` set to `staging`
- [ ] App redeployed and logs show successful connection
- [ ] Analytics page loads without database errors

## Need Help?

Check Railway logs for detailed error messages. The server will show:
- What MongoDB variables it found
- Connection attempts and results
- Any authentication errors


