# Migration Guide: Legacy Admin to User Service

## Overview

This guide helps you migrate from the legacy admin account (username: `admin`, password: `LJM2024secure`) to the User Service authentication system.

**Important:** Your data (products, warranties, etc.) is stored in MongoDB and is **not tied to your username**. Once you authenticate with the User Service, you'll have full access to all your existing data.

## Migration Options

### Option 1: Automated Migration Script (Recommended)

The migration script will:
1. ✅ Export all your data as a backup
2. ✅ Create a User Service account
3. ✅ Set your account to "master" level for full access
4. ✅ Verify the migration

#### Step 1: Set Environment Variables

Create a `.env` file in the AirPod Portal root (or set these in Railway):

```env
# MongoDB connection (already set)
MONGODB_URI=your_mongodb_uri

# User Service URL (already set)
USER_SERVICE_URL=https://autorestock-user-service-production.up.railway.app

# Master account credentials (for setting user level)
USER_SERVICE_MASTER_EMAIL=your_master_email
USER_SERVICE_MASTER_PASSWORD=your_master_password

# Your new account details
NEW_ACCOUNT_EMAIL=admin@ljmuk.co.uk
NEW_ACCOUNT_PASSWORD=LJM2024secure
NEW_ACCOUNT_FIRST_NAME=Admin
NEW_ACCOUNT_LAST_NAME=User
```

#### Step 2: Run the Migration Script

```bash
cd "C:\development\Projects\AirPod Support & Tracking Portal"
node scripts/migrate-to-user-service.js
```

The script will:
- Export all data to `exports/migration-export-YYYY-MM-DD.json`
- Create your User Service account
- Set your account to "master" level
- Verify everything works

#### Step 3: Test Login

1. Go to: `https://autorestock-user-service-production.up.railway.app`
2. Log in with your new account (email and password from above)
3. Verify you can access the admin panel

#### Step 4: Test AirPod Portal Access

1. Go to: `https://airpod-support-tracking-portal-production.up.railway.app/admin/login`
2. Click "Login with User Service"
3. Log in with your new account
4. Verify you can see all your products

### Option 2: Manual Migration

If you prefer to do it manually:

#### Step 1: Export Data (Optional Backup)

You can manually export data using MongoDB Compass or mongodump:

```bash
mongodump --uri="your_mongodb_uri" --out=./backup
```

#### Step 2: Create User Service Account

1. Go to: `https://autorestock-user-service-production.up.railway.app`
2. Click "Create new account"
3. Fill in:
   - **Email:** `admin@ljmuk.co.uk` (or your preferred email)
   - **Password:** `LJM2024secure` (or your preferred password)
   - **First Name:** Admin
   - **Last Name:** User
4. Click "Register"

#### Step 3: Set User Level to "master"

1. Log in to User Service as the **master account** (check Railway variables for `MASTER_EMAIL` and `MASTER_PASSWORD`)
2. Go to "Admin Panel"
3. Find your new account in the user list
4. Click "Set User Level" → Choose "master"
5. Click "Save"

#### Step 4: Test Access

1. Log out and log back in with your new account
2. Go to AirPod Portal
3. Click "Login with User Service"
4. Verify you can access all products

## What Gets Migrated?

### ✅ Data That's Already There (No Migration Needed)

- **Products** - All your products are in MongoDB
- **Warranties** - All warranty records
- **Settings** - All configuration
- **Parts** - All parts data
- **Generations** - All AirPod generation data
- **Setup Instructions** - All setup guides
- **Addon Sales** - All addon products
- **Warranty Pricing** - All pricing data
- **Warranty Terms** - All terms versions

**Important:** This data is **not tied to your username**. It's just protected by authentication. Once you authenticate with the User Service, you'll have full access.

### 📦 Data Export (Backup)

The migration script creates a backup file:
- Location: `exports/migration-export-YYYY-MM-DD.json`
- Contains: All collections exported as JSON
- Purpose: Safety backup in case anything goes wrong

## After Migration

Once you've verified everything works:

1. ✅ Test login with User Service
2. ✅ Verify you can access all products
3. ✅ Test admin functions (add/edit/delete products)
4. ✅ Test warranty management

Then we can:
- Disable the legacy login endpoint
- Remove the legacy login form
- Keep only User Service authentication

## Troubleshooting

### "Account already exists" Error

If you see this, the account was already created. Just:
1. Log in to User Service
2. If you need "master" level, log in as master and set it

### "Cannot set user level" Error

Make sure you're logged in as the master account when setting user levels.

### "Cannot access products" After Migration

This shouldn't happen because products aren't tied to usernames. If it does:
1. Check that you're logged in correctly
2. Check browser console for errors
3. Verify the JWT token is being sent with requests

### Data Export Fails

If the export fails:
1. Check MongoDB connection string
2. Check that you have read permissions
3. Try exporting manually with MongoDB Compass

## Need Help?

If you encounter any issues:
1. Check the migration script output for errors
2. Check Railway logs for both services
3. Verify environment variables are set correctly
4. Try the manual migration option

## Security Notes

- The export file contains all your data - keep it secure
- Don't commit the export file to git
- The `.env` file should not be committed (already in `.gitignore`)
- After migration, consider changing your password

