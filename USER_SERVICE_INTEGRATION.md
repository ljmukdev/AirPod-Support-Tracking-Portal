# User Service Integration - AirPod Support Tracking Portal

This document describes the integration of the AutoRestock User Service with the AirPod Support Tracking Portal.

## Changes Made

### 1. Added Authentication Middleware
- Created `auth.js` - Authentication middleware from User Service
- Supports JWT token validation
- Handles user authentication and authorization

### 2. Updated Login Flow
- Frontend now authenticates with User Service
- Stores JWT tokens in localStorage
- Tracks service connection as "AirPod-Support-Tracking-Portal"

### 3. Updated API Authentication
- Server-side routes now accept JWT tokens
- Falls back to session-based auth for backward compatibility
- All API calls include Authorization header

### 4. Updated Frontend API Calls
- Added `authenticatedFetch()` helper function
- Automatically includes JWT token in requests
- Handles token expiration

## Environment Variables Required

Add to your `.env` file:

```env
JWT_SECRET=your-jwt-secret-here
USER_SERVICE_URL=https://autorestock-user-service-production.up.railway.app
SERVICE_NAME=AirPod-Support-Tracking-Portal
```

**IMPORTANT:** `JWT_SECRET` must match the JWT_SECRET in the User Service deployment.

## Installation

```bash
npm install jsonwebtoken
```

## How It Works

### Login Flow
1. User enters email/password on login page
2. Frontend sends credentials to User Service
3. User Service validates and returns JWT tokens
4. Tokens stored in localStorage
5. Service connection tracked in User Service

### API Requests
1. Frontend includes JWT token in Authorization header
2. Server validates token using auth middleware
3. If valid, request proceeds with user info in `req.user`
4. If invalid, returns 401 Unauthorized

### Logout
1. Clears tokens from localStorage
2. Redirects to login page

## Testing

1. **Login Test:**
   - Go to `/admin/login`
   - Enter valid User Service credentials
   - Should redirect to dashboard

2. **API Test:**
   - After login, make API calls
   - Check browser Network tab for Authorization header
   - Verify requests succeed

3. **Service Connection Test:**
   - Login to User Service Admin Panel
   - Go to "Service Connections"
   - Should see "AirPod-Support-Tracking-Portal" connection

## Troubleshooting

### "JWT_SECRET not set" error
- Make sure JWT_SECRET is set in environment variables
- Must match User Service JWT_SECRET

### "Invalid token" error
- Token may have expired
- Clear localStorage and login again
- Check token expiration time

### CORS errors
- Make sure User Service has your portal domain in ALLOWED_ORIGINS
- Or User Service allows all origins (empty ALLOWED_ORIGINS)

## Files Modified

- `auth.js` - New authentication middleware
- `server.js` - Updated requireAuth to use JWT
- `public/js/admin.js` - Updated login and API calls
- `package.json` - Added jsonwebtoken dependency

## Next Steps

1. Deploy to Railway
2. Set environment variables in Railway
3. Test login with User Service credentials
4. Verify service connection appears in User Service Admin Panel

