# Service-to-Service Authentication Setup

This document explains how the AirPod Support Tracking Portal automatically fetches its JWT_SECRET from the User Service.

## How It Works

1. **AirPod Portal** starts up without `JWT_SECRET` environment variable
2. On first authentication request, it calls User Service's config endpoint
3. **User Service** validates the request using `SERVICE_API_KEY`
4. Returns the `JWT_SECRET` securely
5. **AirPod Portal** stores it in memory and uses it for all JWT validation

## Setup Steps

### 1. User Service Setup (Required)

You need to add a new endpoint to your User Service that returns configuration for authenticated services.

#### Add This Endpoint to User Service:

**File: `routes/services.js` (or similar)**

```javascript
const express = require('express');
const router = express.Router();

// Middleware to validate service API key
function requireServiceApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  const serviceName = req.headers['x-service-name'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Service API key required'
    });
  }

  const apiKey = authHeader.substring(7);

  // Validate API key (compare with env var or database)
  if (apiKey !== process.env.SERVICE_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid service API key'
    });
  }

  // Optionally validate service name
  if (!serviceName) {
    return res.status(400).json({
      success: false,
      error: 'BAD_REQUEST',
      message: 'X-Service-Name header required'
    });
  }

  req.serviceName = serviceName;
  next();
}

// Config endpoint for services
router.get('/config', requireServiceApiKey, (req, res) => {
  res.json({
    success: true,
    data: {
      jwtSecret: process.env.JWT_SECRET,
      serviceName: req.serviceName
    }
  });
});

module.exports = router;
```

**Mount the router in your User Service:**

```javascript
// In your main app.js or server.js
const servicesRouter = require('./routes/services');
app.use('/api/v1/services', servicesRouter);
```

#### Add SERVICE_API_KEY to User Service:

1. Go to Railway → **User Service** → **Variables**
2. Add new variable:
   - Name: `SERVICE_API_KEY`
   - Value: Generate a secure random string (e.g., `openssl rand -base64 32`)
   - Example: `kJ8hF3mN9pQ2rT5wX7yZ1aB4cD6eG8iK0lM3nO5pQ7sU9vW1xY3zA5bC7dE9fG2h`
3. Click **Add** and restart User Service

---

### 2. AirPod Portal Setup (Already Done ✅)

The code is already implemented! You just need to configure the environment variable.

#### Add SERVICE_API_KEY to AirPod Portal:

1. Go to Railway → **AirPod-Support-Tracking-Portal** → **Variables**
2. Add new variable:
   - Name: `SERVICE_API_KEY`
   - Value: **[Same value as User Service SERVICE_API_KEY]**
3. Click **Add**
4. Railway will auto-redeploy

---

## Verification

### After Deployment:

**1. Check AirPod Portal Logs:**

You should see:
```
✅ SERVICE_API_KEY configured - will fetch JWT_SECRET from User Service on first auth request
```

**2. Log in to Admin Portal:**

Watch the logs during login. You should see:
```
[AUTH] Fetching JWT_SECRET from User Service (attempt 1/4)...
[AUTH] ✅ JWT_SECRET fetched successfully from User Service
[JWT] ✅ Token valid - User: your@email.com, Level: master
```

**3. Dashboard Should Load:**

All statistics, products, and warranties should be visible.

---

## Troubleshooting

### Error: "SERVICE_API_KEY not configured"

**Solution:** Set `SERVICE_API_KEY` in AirPod Portal's Railway environment variables.

### Error: "Failed to fetch config: 404"

**Solution:** User Service doesn't have the `/api/v1/services/config` endpoint. Add it following the setup steps above.

### Error: "Failed to fetch config: 401"

**Solution:**
- `SERVICE_API_KEY` values don't match between services
- OR User Service's validation logic is rejecting the request
- Check both services have the **exact same** `SERVICE_API_KEY` value

### Error: "Invalid response from User Service: jwtSecret not found"

**Solution:** User Service's config endpoint isn't returning the correct format. Response must be:
```json
{
  "success": true,
  "data": {
    "jwtSecret": "your-jwt-secret-here"
  }
}
```

---

## Fallback Options

If service-to-service auth doesn't work, you can still use manual configuration:

**Option A: Set JWT_SECRET directly**
```
JWT_SECRET=your-jwt-secret-here
```

**Option B: Use Railway variable reference**
```
JWT_SECRET=${{UserService.JWT_SECRET}}
```

---

## Security Notes

- ✅ JWT_SECRET is fetched over HTTPS
- ✅ Requires authentication via SERVICE_API_KEY
- ✅ Stored in memory only (never persisted)
- ✅ Automatic retry with exponential backoff
- ✅ Failed fetch doesn't crash the server
- ⚠️ SERVICE_API_KEY must be kept secret (treat like a password)
- ⚠️ Rotate SERVICE_API_KEY periodically for security

---

## Architecture Diagram

```
┌─────────────────────┐
│  AirPod Portal      │
│  (No JWT_SECRET)    │
└──────────┬──────────┘
           │
           │ 1. First auth request
           ▼
    ┌──────────────────────┐
    │ requireAuth()         │
    │ calls ensureJwtSecret()│
    └──────────┬───────────┘
               │
               │ 2. GET /api/v1/services/config
               │    Authorization: Bearer {SERVICE_API_KEY}
               ▼
┌──────────────────────────┐
│  User Service            │
│  Validates SERVICE_API_KEY│
│  Returns JWT_SECRET      │
└──────────┬───────────────┘
           │
           │ 3. { success: true, data: { jwtSecret: "..." } }
           ▼
┌─────────────────────────┐
│  AirPod Portal          │
│  Stores JWT_SECRET      │
│  in memory              │
│  Validates JWT tokens   │
└─────────────────────────┘
```

---

## Next Steps

1. ✅ Add `/api/v1/services/config` endpoint to User Service
2. ✅ Set `SERVICE_API_KEY` in both services (same value)
3. ✅ Deploy and test
4. ✅ Verify logs show successful JWT_SECRET fetch
5. ✅ Confirm dashboard loads with data

