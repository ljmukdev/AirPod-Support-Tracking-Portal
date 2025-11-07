# Railway MongoDB Setup - Step by Step

## The Problem
Railway is providing MongoDB variables as templates (like `${MONGOUSER}`) instead of actual values. We need to fix this.

## Solution: Step-by-Step Instructions

### Step 1: Get the MongoDB Connection String from Railway

1. **Go to Railway Dashboard** → https://railway.app
2. **Click on your MongoDB service** (the one named "AutoRestockDB" or similar)
3. **Click on the "Variables" tab**
4. **Look for a variable that contains the full connection string**

   You should see something like:
   - `MONGO_URL` or `MONGODB_URI` 
   - The value should look like: `mongodb://username:password@host:port/database`

5. **Copy the FULL connection string** (the entire value)

### Step 2: Add it to Your App Service

1. **Click on your App service** (the one running the Node.js app)
2. **Click on "Variables" tab**
3. **Click "New Variable"**
4. **Add this variable:**
   - **Name:** `MONGODB_URI`
   - **Value:** Paste the FULL connection string you copied from Step 1
   - **Example value:** `mongodb://mongo:password123@host.railway.internal:27017/railway`

5. **Click "Add"**

### Step 3: Verify

1. Railway will automatically redeploy your app
2. **Check the logs** - you should see:
   - ✅ "Connected to MongoDB successfully"
   - NOT: ❌ "MongoDB connection error"

### Alternative: If Railway Provides Individual Components

If Railway only provides separate variables (MONGOUSER, MONGOPASSWORD, etc.):

1. **In your App service → Variables**
2. **Add these variables one by one:**
   - `MONGOUSER` = (value from MongoDB service)
   - `MONGOPASSWORD` = (value from MongoDB service)
   - `MONGOHOST` = (value from MongoDB service)
   - `MONGOPORT` = (value from MongoDB service, usually 27017)
   - `MONGODATABASE` = (value from MongoDB service, usually 'railway' or 'admin')

The code will automatically build the connection string from these.

## Quick Check

After adding the variable, check Railway logs. You should see:
- "Attempting MongoDB connection..."
- "✅ Connected to MongoDB successfully"

If you still see errors, the logs will now show exactly which variables are available and which are templates.



