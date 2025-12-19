# Migration to AutoRestock User Service - Complete

## ✅ Migration Status: COMPLETE

The AirPod Support Tracking Portal has been successfully migrated to use the AutoRestock User Service for authentication.

## What Changed

### 1. Authentication System
- **Before:** Local session-based authentication using `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- **After:** Centralized JWT-based authentication via AutoRestock User Service

### 2. Login Flow
- **Before:** Direct login form that authenticated against local credentials
- **After:** Universal login flow that redirects to User Service, then back to portal

### 3. User Management
- **Before:** Single admin user defined in environment variables
- **After:** Multiple users managed centrally in User Service with role-based access (master, managing, standard)

## Migration Steps Completed

1. ✅ Integrated User Service authentication middleware (`auth.js`)
2. ✅ Updated login page to use universal login flow
3. ✅ Added `/auth/callback` route to handle User Service redirects
4. ✅ Updated `requireAuthHTML` middleware to accept JWT tokens
5. ✅ Updated `requireAuth` middleware to use JWT tokens
6. ✅ Deprecated old `/api/admin/login` endpoint
7. ✅ Updated frontend to use JWT tokens from User Service

## How to Use

### For Users

1. **Login:** Click "Login with AutoRestock User Service" button on the login page
2. **Create Account:** If you don't have an account, you can create one during the login flow
3. **Master Account:** Use the master account credentials configured in the User Service

### For Administrators

1. **User Management:** Manage users through the User Service admin panel
2. **Role Assignment:** Assign roles (master, managing, standard) through User Service
3. **Service Connections:** View and manage service connections in User Service admin panel

## Deprecated Features

### Old Login Endpoint
- **Endpoint:** `POST /api/admin/login`
- **Status:** Deprecated (returns 410 Gone)
- **Action:** Use User Service authentication instead

### Environment Variables (No Longer Used)
- `ADMIN_USERNAME` - No longer used
- `ADMIN_PASSWORD` - No longer used

### Session-Based Auth
- Session-based authentication is no longer used
- All authentication is now JWT-based via User Service

## Benefits

1. **Centralized Authentication:** Single sign-on across all AutoRestock microservices
2. **Better Security:** JWT tokens with expiration and refresh tokens
3. **User Management:** Centralized user management with role-based access control
4. **Audit Trail:** All login attempts tracked in User Service
5. **Service Tracking:** Track which services each user has accessed

## Rollback Plan

If you need to rollback (not recommended):

1. Restore the old `/api/admin/login` endpoint
2. Re-enable session-based authentication in `requireAuthHTML`
3. Update login page to use old form
4. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables

## Support

For issues or questions:
1. Check User Service admin panel for login attempts and errors
2. Verify JWT_SECRET matches between services
3. Check service connections in User Service admin panel
4. Review logs in Railway dashboard

