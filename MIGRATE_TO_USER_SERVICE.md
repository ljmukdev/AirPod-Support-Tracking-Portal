# Migrate Your Account to User Service

## Step-by-Step Migration Guide

### Step 1: Create Your Account in User Service

1. **Go to User Service:**
   - Visit: `https://autorestock-user-service-production.up.railway.app`
   - Click "Create new account" link

2. **Register with your email:**
   - **Email:** Use the same email you want to use for the AirPod portal (or your preferred email)
   - **Password:** Choose a secure password (you can use the same as your legacy login if you want)
   - **First Name:** Your first name
   - **Last Name:** Your last name
   - **Company Name:** (Optional) Your company name
   - Click "Register"

3. **You'll be automatically logged in** after registration

### Step 2: Set Your User Level (If Needed)

If you need admin access:

1. **Log in as Master User:**
   - Go to User Service
   - Log in with your master account credentials (from Railway environment variables: `MASTER_EMAIL` and `MASTER_PASSWORD`)

2. **Go to Admin Panel:**
   - Click "Admin Panel" tab (only visible to master users)

3. **Set Your User Level:**
   - Find your user in the user list
   - Click "Set User Level" button
   - Set to "master" or "managing" depending on your needs

### Step 3: Test Login with User Service

1. **Go to AirPod Portal:**
   - Visit: `https://airpodsupport.ljmuk.co.uk/admin/login`

2. **Click "Login with User Service" button**

3. **Log in with your User Service credentials:**
   - Use the email and password you just created

4. **Verify Access:**
   - You should be redirected to the dashboard
   - Check that you can see all your products

### Step 4: Retire Legacy Login (After Testing)

Once you've confirmed everything works:

1. We'll disable the legacy login endpoint
2. Remove the legacy login form
3. Keep only the User Service login

## Quick Option: Use Master Account

If you want immediate access without creating a new account:

1. **Use Master Account:**
   - Click "Login with User Service" button
   - Log in with your master account credentials (from Railway: `MASTER_EMAIL` and `MASTER_PASSWORD`)
   - This gives you full access immediately

2. **Create your personal account later** if needed

## Need Help?

If you encounter any issues:
1. Check that your account was created successfully in User Service
2. Verify your user level is set correctly (if you need admin access)
3. Check Railway logs for any errors
4. Try logging in with the master account first to verify the system works

