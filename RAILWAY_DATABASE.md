# Railway Database Setup

## Current Issue: Ephemeral Filesystem

Railway's filesystem is **ephemeral**, meaning files are deleted when the container restarts. This affects SQLite databases.

## Solutions

### Option 1: Use Railway PostgreSQL (Recommended)

Railway offers managed PostgreSQL databases that persist data properly.

1. **Add PostgreSQL Service:**
   - Go to your Railway project
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically create a PostgreSQL database

2. **Get Connection String:**
   - Railway will provide `DATABASE_URL` environment variable
   - Format: `postgresql://user:password@host:port/database`

3. **Update Code:**
   - Install `pg` package: `npm install pg`
   - Replace SQLite with PostgreSQL connection
   - Update all SQL queries to PostgreSQL syntax

### Option 2: Use Railway Persistent Volume (For SQLite)

1. **Add Volume:**
   - Go to your Railway project
   - Click "New" → "Volume"
   - Mount it to `/data` or similar path

2. **Set Environment Variable:**
   - Add `DATABASE_PATH=/data/database.sqlite`
   - This tells the app to use the persistent volume

### Option 3: Quick Fix - Use Railway's Filesystem

The code has been updated to use `DATABASE_PATH` environment variable. You can:

1. **Set DATABASE_PATH in Railway:**
   - Go to your project → Variables
   - Add: `DATABASE_PATH=/tmp/database.sqlite`
   - Note: This is still ephemeral but works for testing

## Recommended: Switch to PostgreSQL

For production, PostgreSQL is more reliable on Railway. I can help you migrate the code to use PostgreSQL if you'd like.

## Check Current Database

To see if data is being saved, check Railway logs:
- Go to Railway dashboard → Your project → Deployments → View logs
- Look for "Part added successfully" or "Part updated successfully" messages
- Check for any database errors





