# Railway Deployment Guide

## Quick Setup Steps

1. **Go to Railway**: https://railway.app
2. **Sign up/Login** with your GitHub account
3. **New Project** → **Deploy from GitHub repo**
4. **Select Repository**: `ljmukdev/AirPod-Support-Tracking-Portal`
5. **Railway will automatically detect** the Node.js project and deploy

## Environment Variables

After deployment, add these environment variables in Railway dashboard:

### Required for Production:

```
ADMIN_USERNAME=your_secure_username
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=generate_a_random_secret_key_here
NODE_ENV=production
```

### How to Generate SESSION_SECRET:

Run this command in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use an online generator: https://randomkeygen.com/

## Database

Railway will automatically create the SQLite database file on first run. The database persists in Railway's filesystem.

**Note**: For production with high traffic, consider migrating to PostgreSQL (Railway offers managed PostgreSQL).

## Post-Deployment

1. **Get your Railway URL** from the dashboard
2. **Test the customer site**: `https://your-app.railway.app`
3. **Test admin panel**: `https://your-app.railway.app/admin/login`
4. **Add your first product** using the admin dashboard

## Troubleshooting

- If the app doesn't start, check Railway logs in the dashboard
- Ensure PORT environment variable is set (Railway sets this automatically)
- Database file is created automatically on first run
- Check that all environment variables are set correctly

## Custom Domain (Optional)

1. Go to your project settings in Railway
2. Click on "Domains"
3. Add your custom domain
4. Railway will provide DNS settings to configure






