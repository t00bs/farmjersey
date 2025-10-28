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

After migration, you need to manually set the first admin user:

1. Go to **SQL Editor** in Supabase
2. First, sign up a user through your app (or manually create one in **Authentication** → **Users**)
3. Run this SQL to make that user an admin (replace the email):

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

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
