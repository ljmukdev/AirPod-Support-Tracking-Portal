# Fix MongoDB Connection String

## Issue: Authentication Failed

The connection string needs to include `authSource=admin` for Railway MongoDB.

## Solution:

Update your `.env` file connection string to include the authSource parameter:

```env
MONGODB_URI=mongodb://mongo:iOUkcseoXlOMsdgdTADZQqmbyUlebNBN@gondola.proxy.rlwy.net:11130/ARSDB?authSource=admin
```

Or if you want to be more explicit:

```env
MONGODB_URI=mongodb://mongo:YOUR_PASSWORD@gondola.proxy.rlwy.net:11130/ARSDB?authSource=admin
MONGODB_DB=ARSDB
```

## Steps:

1. **Double-check the password:**
   - Go to Railway → ARSDB → Variables
   - Click the eye icon next to `MONGO_INITDB_ROOT_PASSWORD`
   - Make sure you copied it correctly (watch for 0 vs O, 1 vs l, etc.)

2. **Update your `.env` file:**
   ```env
   MONGODB_URI=mongodb://mongo:YOUR_ACTUAL_PASSWORD@gondola.proxy.rlwy.net:11130/ARSDB?authSource=admin
   ```

3. **Try again:**
   ```bash
   node scripts/verify-data-access.js
   ```

## Alternative: Use MONGO_URL Instead

If `MONGO_PUBLIC_URL` doesn't work, you can try using the internal `MONGO_URL` from Railway, but you'll need to replace `mongodb.railway.internal` with the public hostname. However, `MONGO_PUBLIC_URL` should work for external connections.

## Common Issues:

- **Password typo:** Make sure you copied the password exactly (case-sensitive)
- **Missing authSource:** Railway MongoDB requires `?authSource=admin`
- **Wrong host:** Make sure you're using `gondola.proxy.rlwy.net` (public) not `mongodb.railway.internal` (internal only)

