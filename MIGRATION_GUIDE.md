# Supabase Migration - Final Steps

Your application has been successfully migrated to Supabase! The code is ready, but you need to complete a few steps in your Supabase dashboard to activate the new system.

## Step 1: Run the Database Migration

1. Open your Supabase project dashboard at https://supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `supabase-migration.sql` from this project
5. Copy ALL the SQL code and paste it into the SQL Editor
6. Click **Run** to execute the migration
7. You should see a success message confirming all tables and policies were created

## Step 2: Update Database Connection

Your application is currently still connecting to the old Neon database. You need to update it to connect to Supabase:

1. In Supabase dashboard, go to **Project Settings** → **Database**
2. Scroll down to **Connection String**
3. Choose **URI** format
4. Copy the connection string (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`)
5. In your Replit project, update the `DATABASE_URL` secret with this new connection string
6. **Important**: Make sure to replace `[YOUR-PASSWORD]` in the connection string with your actual database password

## Step 3: Configure Supabase Authentication

### Enable Email/Password Authentication
1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Find **Email** provider
3. Ensure it's **enabled**
4. Toggle ON **Confirm email** if you want email verification (recommended for production)

### Configure Magic Link (Already Included)
Magic links are automatically enabled with the Email provider. No additional setup needed!

### Set Redirect URLs
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your Replit app domain (e.g., `https://your-repl-name.replit.app`)
3. Add **Redirect URLs**:
   - `https://your-repl-name.replit.app`
   - `https://your-repl-name.replit.app/**`
   - For development: `http://localhost:5000` and `http://localhost:5000/**`

### Optional: Customize Email Templates
1. Go to **Authentication** → **Email Templates**
2. Customize the templates for:
   - Confirm signup
   - Magic Link
   - Reset password

## Step 4: Create Your First Admin User

**IMPORTANT**: The system now enforces invitation-only signup at the database level. To create the first admin, you must manually create them in Supabase:

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Add User** → **Create new user**
3. Fill in:
   - Email: your admin email
   - Password: create a secure password
   - **User Metadata** (click to expand): Add this JSON:
     ```json
     {
       "role": "admin",
       "first_name": "Admin",
       "last_name": "User"
     }
     ```
4. Click **Create User**
5. The system will automatically create the admin account with full permissions
6. You can now log in at `https://your-repl-name.replit.app` with this email and password

**Why this is needed**: The pre-signup hook validates invitations for all signups. The only way to bypass this requirement is to set `role: "admin"` in the user metadata when creating the user manually in Supabase dashboard.

## Step 5: Test the System

After completing all steps above, restart your Replit application and test:

### Test Regular User Flow:
1. As an admin, create an invitation from the Admin Dashboard → Invitations tab
2. Use the invitation link to sign up as a new user
3. Try logging in with email/password
4. Try logging out and using magic link login
5. Verify the user can only see their own applications

### Test Admin Flow:
1. Log in as the admin user you created
2. Verify you can access the Admin Dashboard
3. Verify you can see all applications from all users
4. Try creating/managing invitations

### Test Permissions:
1. Regular users should NOT see the Admin Dashboard link
2. Regular users should NOT be able to access `/admin-dashboard` even if they type the URL
3. Regular users should only see their own grant applications
4. Admins should see all applications and have full access

## Troubleshooting

### "Invalid or expired token" errors
- Make sure you've updated the DATABASE_URL to point to Supabase
- Restart your Replit application after updating DATABASE_URL

### Users can't sign up
- Check that the invitation system is working
- Verify RLS policies are enabled in Supabase
- Check browser console for errors

### Email not sending
- Verify Supabase email settings in Authentication → Email Templates
- For production, configure custom SMTP in Authentication → Settings

### Database connection errors
- Double-check the DATABASE_URL format
- Ensure you replaced `[YOUR-PASSWORD]` with your actual password
- Verify your Supabase database is running (it should show "Healthy" in dashboard)

## What Changed

### Authentication
- ✅ Replaced Replit Auth (OIDC) with Supabase Auth
- ✅ Added email/password authentication
- ✅ Added magic link (passwordless) authentication
- ✅ JWT-based authentication (no more server sessions)

### Permissions
- ✅ Role-based access using database `role` column
- ✅ Row Level Security policies enforcing permissions at database level
- ✅ Admins can access all data, users can only access their own

### Database
- ✅ Migrated to Supabase PostgreSQL
- ✅ All tables recreated with proper relationships
- ✅ RLS policies protecting all sensitive data

### Invitation System
- ✅ Pre-signup validation - only invited users can create accounts
- ✅ Invitation emails sent via Resend
- ✅ Tokens expire after 7 days
- ✅ One-time use tokens

## Next Steps

After successfully testing:

1. ✅ Update `replit.md` to document the new Supabase architecture
2. ✅ Configure production SMTP for email delivery (optional)
3. ✅ Set up proper backup strategy for Supabase database
4. ✅ Review and adjust RLS policies if needed for your specific use case

## Need Help?

- Supabase Documentation: https://supabase.com/docs
- Supabase Auth Guide: https://supabase.com/docs/guides/auth
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
