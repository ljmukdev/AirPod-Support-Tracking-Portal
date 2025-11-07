# Railway MongoDB Environment Variables Setup

## Problem
The MongoDB connection is failing because environment variables are not set in Railway.

## Solution: Set MongoDB Environment Variables

### Step 1: Get MongoDB Credentials
1. Go to Railway Dashboard → Your MongoDB Service (AutoRestockDB)
2. Click on the **Variables** tab
3. Find and copy these values:
   - `MONGO_INITDB_ROOT_USERNAME` (usually `mongo`)
   - `MONGO_INITDB_ROOT_PASSWORD` (copy the exact password)
   - `RAILWAY_PRIVATE_DOMAIN` (should be something like `mongodb.railway.internal`)

### Step 2: Set Variables in Your App Service
1. Go to Railway Dashboard → Your App Service (AirPod Support & Tracking Portal)
2. Click on the **Variables** tab
3. Add these variables with **ACTUAL VALUES** (not templates):

```
MONGOUSER = mongo
MONGOPASSWORD = (paste the exact password from MongoDB service)
MONGOHOST = mongodb.railway.internal
MONGOPORT = 27017
MONGODATABASE = AutoRestockDB
```

### Step 3: Verify Variables
Make sure:
- ✅ No quotes around values
- ✅ No extra spaces
- ✅ `MONGOHOST` uses the private domain (not public URL)
- ✅ `MONGOPASSWORD` matches exactly (copy-paste to avoid typos)

### Step 4: Redeploy
Railway will automatically redeploy when you save variables. Check the logs - you should see:
```
✅ Connected to MongoDB successfully using authSource: admin (standard)
```

## Alternative: Use Railway Service Reference (Recommended)

If your MongoDB service is in the same Railway project:

1. In your App Service → Variables tab
2. Click **"New Variable"**
3. Click **"Reference"** tab
4. Select your MongoDB service
5. Add these references:
   - `MONGOUSER` → Reference `MONGO_INITDB_ROOT_USERNAME`
   - `MONGOPASSWORD` → Reference `MONGO_INITDB_ROOT_PASSWORD`
   - `MONGOHOST` → Reference `RAILWAY_PRIVATE_DOMAIN`
   - `MONGOPORT` → Set manually to `27017`
   - `MONGODATABASE` → Set manually to `AutoRestockDB`

This way, Railway automatically resolves the values and updates them if they change.

## Troubleshooting

### Error: "getaddrinfo ENOTFOUND undefined"
- **Cause**: `MONGOHOST` is not set or is `undefined`
- **Fix**: Set `MONGOHOST` to your MongoDB service's `RAILWAY_PRIVATE_DOMAIN`

### Error: "Authentication failed"
- **Cause**: Wrong username/password or authSource
- **Fix**: 
  1. Verify `MONGOUSER` matches `MONGO_INITDB_ROOT_USERNAME`
  2. Verify `MONGOPASSWORD` matches `MONGO_INITDB_ROOT_PASSWORD` exactly
  3. Make sure there are no extra spaces or quotes

### Error: "Cannot read properties of undefined (reading 'collection')"
- **Cause**: Database connection failed, but server started anyway
- **Fix**: Set up MongoDB environment variables (see above)

## Test Connection
After setting variables, check Railway logs. You should see:
```
✅ Connected to MongoDB successfully using authSource: admin (standard)
Database indexes created
```

If you see errors, double-check all variables match exactly.



