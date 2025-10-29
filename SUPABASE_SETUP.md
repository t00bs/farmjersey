# Supabase Setup Instructions

## Step 1: Run the Database Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `supabase-migration.sql` and paste it into the editor
5. Click **Run** to execute the migration
6. Verify all tables were created successfully

## Step 2: Configure Authentication

### Enable Email/Password Authentication
1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Find **Email** provider
3. Ensure it's **enabled**
4. Toggle on **Confirm email** if you want email verification (recommended)

### Enable Magic Link
1. In the same **Providers** section
2. The Email provider already includes Magic Link functionality
3. No additional setup needed - users can request magic links via the auth flow

### Configure Email Templates (Optional)
1. Go to **Authentication** → **Email Templates**
2. Customize the templates for:
   - Confirm signup
   - Magic Link
   - Reset password

### Set Redirect URLs
1. Go to **Authentication** → **URL Configuration**
2. Add your application URLs to **Site URL** and **Redirect URLs**:
   - For development: `http://localhost:5000`, `http://localhost:5000/**`
   - For production: Add your Replit app domain

## Step 3: Create First Admin User

**IMPORTANT**: The system enforces invitation-only signup. To create the first admin user:

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Add User** → **Create new user**
3. Fill in the email and password
4. In **User Metadata**, add this JSON:
   ```json
   {
     "role": "admin",
     "first_name": "Admin",
     "last_name": "User"
   }
   ```
5. Click **Create User**
6. The user will be created as an admin and can log in immediately

**Note**: Setting `role: "admin"` in user metadata during manual creation is the ONLY way to bypass the invitation requirement. This is intentional for security.

## Step 4: Verify RLS Policies

1. Go to **Database** → **Tables** in Supabase
2. Click on each table
3. Go to the **Policies** tab
4. Verify that RLS is enabled and policies are created

## Step 5: Test the Connection

The application will automatically connect using the environment variables you've already set:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Pre-Signup Validation

The system implements invitation-only signup:
1. Admins create invitations through the Admin Dashboard
2. Invitations are sent via email with a unique token
3. Users can only sign up if they have a valid invitation token
4. The backend validates the token before allowing signup
