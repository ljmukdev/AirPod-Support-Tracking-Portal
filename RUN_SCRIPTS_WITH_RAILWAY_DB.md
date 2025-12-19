# Running Scripts with Railway MongoDB (No Local DB Needed)

## ✅ You Don't Need a Local Database!

The scripts connect to Railway's MongoDB remotely. You just need:
1. The MongoDB connection string from Railway
2. Node.js installed on your local machine
3. The script files

---

## Step-by-Step Guide

### Step 1: Get MongoDB Connection String from Railway

1. Go to **Railway Dashboard**
2. Select your **AirPod Support Tracking Portal** project
3. Go to **Variables** tab
4. Find `MONGODB_URI` or `MONGO_URL`
5. **Copy the entire connection string** (it looks like: `mongodb://user:pass@host:port/database`)

### Step 2: Create `.env` File Locally

In your local AirPod Portal folder, create a `.env` file:

```env
# Paste your Railway MongoDB connection string here
MONGODB_URI=mongodb://your_railway_connection_string_here

# For migration script, also add:
USER_SERVICE_URL=https://autorestock-user-service-production.up.railway.app
USER_SERVICE_MASTER_EMAIL=your_master_email
USER_SERVICE_MASTER_PASSWORD=your_master_password
NEW_ACCOUNT_EMAIL=admin@ljmuk.co.uk
NEW_ACCOUNT_PASSWORD=LJM2024secure
```

**Important:** The `.env` file is already in `.gitignore`, so it won't be committed.

### Step 3: Install Dependencies (If Not Already Done)

```bash
cd "C:\development\Projects\AirPod Support & Tracking Portal"
npm install
```

### Step 4: Run the Scripts

**For verification:**
```bash
node scripts/verify-data-access.js
```

**For migration:**
```bash
node scripts/migrate-to-user-service.js
```

The scripts will:
- Connect to Railway's MongoDB (remote connection)
- Read/write data directly to Railway's database
- Show you the results

---

## Alternative: Use the API Endpoint (Even Easier!)

I've added an API endpoint that does the verification for you. No local setup needed!

### Option A: Via Browser (After Login)

1. Log in to your AirPod Portal
2. Go to:
   ```
   https://airpod-support-tracking-portal-production.up.railway.app/api/admin/verify-data-access
   ```
3. You'll see JSON with the verification results

### Option B: Via curl/Postman

1. Get your access token (from User Service login)
2. Call:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://airpod-support-tracking-portal-production.up.railway.app/api/admin/verify-data-access
   ```

---

## What Happens When You Run Locally?

```
Your Local Machine          Railway MongoDB
     │                            │
     │  (1) Connect via           │
     │      connection string     │
     ├───────────────────────────>│
     │                            │
     │  (2) Query data            │
     │<───────────────────────────┤
     │                            │
     │  (3) Show results          │
     │                            │
```

**The script runs on your machine, but connects to Railway's database remotely.**

---

## Troubleshooting

### "Cannot connect to MongoDB"
- Check that your `MONGODB_URI` is correct
- Make sure Railway's MongoDB is accessible (not blocked by firewall)
- Try the connection string in MongoDB Compass to verify it works

### "Module not found"
- Run `npm install` in the project directory
- Make sure you're in the correct directory

### "Environment variable not set"
- Make sure `.env` file exists in the project root
- Check that `MONGODB_URI` is spelled correctly in `.env`

---

## Quick Start

**Simplest approach - Use the API endpoint:**

1. Log in to AirPod Portal
2. Visit: `/api/admin/verify-data-access`
3. Done! ✅

**For migration - Run locally:**

1. Create `.env` with Railway MongoDB URI
2. Run: `node scripts/migrate-to-user-service.js`
3. Done! ✅

---

## Security Note

⚠️ **Never share your MongoDB connection string!** It contains credentials.

The `.env` file is already in `.gitignore`, so it won't be committed to git.

