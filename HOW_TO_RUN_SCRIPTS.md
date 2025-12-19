# How to Run Scripts with Railway Deployment

## Option 1: Run Locally with Railway MongoDB (Recommended)

This is the easiest way - run the script on your local machine but connect to Railway's MongoDB.

### Step 1: Get Your MongoDB Connection String from Railway

1. Go to Railway Dashboard
2. Select your AirPod Support Tracking Portal project
3. Go to **Variables** tab
4. Find `MONGODB_URI` or `MONGO_URL`
5. Copy the connection string

### Step 2: Create Local `.env` File

Create a `.env` file in the AirPod Portal root directory:

```env
MONGODB_URI=your_railway_mongodb_connection_string_here
```

**Important:** Don't commit this file to git (it's already in `.gitignore`)

### Step 3: Run the Script Locally

```bash
cd "C:\development\Projects\AirPod Support & Tracking Portal"
node scripts/verify-data-access.js
```

The script will connect to Railway's MongoDB and show you the results.

---

## Option 2: Add as API Endpoint (For Remote Access)

If you want to run it from anywhere without local setup, we can add it as an API endpoint.

### Add to `server.js`:

```javascript
// Data access verification endpoint (Admin only)
app.get('/api/admin/verify-data-access', requireAuth, requireDB, async (req, res) => {
    try {
        const productsSample = await db.collection('products').find({}).limit(1).toArray();
        const productCount = await db.collection('products').countDocuments();
        const warrantyCount = await db.collection('warranties').countDocuments();
        
        let hasUserOwnership = false;
        if (productsSample.length > 0) {
            const product = productsSample[0];
            hasUserOwnership = 'userId' in product || 'ownerId' in product || 'created_by' in product;
        }
        
        res.json({
            success: true,
            data: {
                hasUserOwnership,
                productCount,
                warrantyCount,
                message: hasUserOwnership 
                    ? 'Products have user ownership fields' 
                    : 'Products have NO user ownership fields - data is shared',
                conclusion: hasUserOwnership
                    ? 'Data migration may be needed'
                    : 'No mounting needed - data is accessible to all authenticated users'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Then call it:

```bash
# Get your access token first (from User Service login)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://airpod-support-tracking-portal-production.up.railway.app/api/admin/verify-data-access
```

---

## Option 3: Railway One-Off Command (If Available)

Railway doesn't have a built-in one-off command feature, but you can:

1. **Temporarily add a script to package.json:**
   ```json
   {
     "scripts": {
       "verify": "node scripts/verify-data-access.js"
     }
   }
   ```

2. **Use Railway's shell access** (if available in your plan):
   - Go to Railway Dashboard
   - Select your service
   - Look for "Shell" or "Terminal" option
   - Run: `node scripts/verify-data-access.js`

---

## Option 4: Migration Script (Same Approach)

For the migration script (`migrate-to-user-service.js`), use the same approach:

### Run Locally with Railway MongoDB:

1. Create `.env` file:
   ```env
   MONGODB_URI=your_railway_mongodb_connection_string
   USER_SERVICE_URL=https://autorestock-user-service-production.up.railway.app
   USER_SERVICE_MASTER_EMAIL=your_master_email
   USER_SERVICE_MASTER_PASSWORD=your_master_password
   NEW_ACCOUNT_EMAIL=admin@ljmuk.co.uk
   NEW_ACCOUNT_PASSWORD=LJM2024secure
   ```

2. Run the script:
   ```bash
   node scripts/migrate-to-user-service.js
   ```

---

## Quick Start (Recommended)

**For verification:**
```bash
# 1. Create .env file with Railway MongoDB URI
# 2. Run:
node scripts/verify-data-access.js
```

**For migration:**
```bash
# 1. Create .env file with all required variables
# 2. Run:
node scripts/migrate-to-user-service.js
```

---

## Security Note

⚠️ **Never commit your `.env` file to git!** It's already in `.gitignore`, but double-check before committing.

The `.env` file should contain:
- MongoDB connection strings
- API keys
- Passwords
- Other sensitive data

