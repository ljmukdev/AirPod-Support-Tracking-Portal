# Quick Migration Steps - Legacy to User Service

## ✅ You're Currently Logged In with Legacy Login

Great! Now let's set up your User Service account.

## Option 1: Use Master Account (Quickest)

1. **Click "Login with User Service" button** on the AirPod portal login page
2. **Log in with your master account:**
   - Email: Check Railway → User Service → Variables → `MASTER_EMAIL`
   - Password: Check Railway → User Service → Variables → `MASTER_PASSWORD`
3. **You'll have full access immediately!**

## Option 2: Create Your Personal Account

### Step 1: Register in User Service

1. Go to: `https://autorestock-user-service-production.up.railway.app`
2. Click "Create new account"
3. Fill in:
   - **Email:** Your email address
   - **Password:** Your password (can be same as legacy login)
   - **First Name:** Your first name
   - **Last Name:** Your last name
   - **Company Name:** (Optional)
4. Click "Register"

### Step 2: Set Your User Level (If You Need Admin Access)

1. **Log in to User Service as Master:**
   - Use master credentials from Railway

2. **Go to Admin Panel:**
   - Click "Admin Panel" tab

3. **Find Your User:**
   - Look for your email in the user list

4. **Set User Level:**
   - Click "Set User Level" button
   - Choose:
     - **"master"** - Full access (like your legacy admin)
     - **"managing"** - Can manage other users
     - **"standard"** - Regular user

### Step 3: Test Login

1. Go to AirPod portal login page
2. Click "Login with User Service"
3. Log in with your new account
4. Verify you can access all your products

## Step 4: Retire Legacy Login (After Testing)

Once you've confirmed everything works:

1. ✅ Test login with User Service works
2. ✅ Verify you can access all products
3. ✅ Test all admin functions

Then we'll:
- Disable legacy login endpoint
- Remove legacy login form
- Keep only User Service login

## Need Help?

- **Can't log in?** Try the master account first
- **Need admin access?** Set your user level to "master" in User Service admin panel
- **Products missing?** They're in MongoDB, not tied to login - you should see them once logged in

