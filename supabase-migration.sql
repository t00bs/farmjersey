-- Supabase Migration Script for Rural Support Scheme Portal
-- This creates all necessary tables and Row Level Security policies

-- ============================================
-- 1. USERS TABLE (extends auth.users)
-- ============================================
-- Note: Supabase auth.users already exists, we create a profiles table to extend it
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  profile_image_url VARCHAR(500),
  role VARCHAR(50) DEFAULT 'user', -- 'admin' or 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 2. INVITATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "Admins can view all invitations"
  ON public.invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 3. GRANT APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.grant_applications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  year INTEGER NOT NULL,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  agricultural_return_completed BOOLEAN DEFAULT FALSE,
  land_declaration_completed BOOLEAN DEFAULT FALSE,
  consent_form_completed BOOLEAN DEFAULT FALSE,
  supporting_docs_completed BOOLEAN DEFAULT FALSE,
  digital_signature TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on grant_applications
ALTER TABLE public.grant_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
  ON public.grant_applications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own applications
CREATE POLICY "Users can insert own applications"
  ON public.grant_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own applications
CREATE POLICY "Users can update own applications"
  ON public.grant_applications FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
  ON public.grant_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all applications
CREATE POLICY "Admins can update all applications"
  ON public.grant_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 4. AGRICULTURAL RETURNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agricultural_returns (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES public.grant_applications(id),
  crop_data JSONB,
  land_usage JSONB,
  total_acres INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on agricultural_returns
ALTER TABLE public.agricultural_returns ENABLE ROW LEVEL SECURITY;

-- Users can manage their own agricultural returns (through application ownership)
CREATE POLICY "Users can view own agricultural returns"
  ON public.agricultural_returns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = agricultural_returns.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own agricultural returns"
  ON public.agricultural_returns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = agricultural_returns.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own agricultural returns"
  ON public.agricultural_returns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = agricultural_returns.application_id
      AND user_id = auth.uid()
    )
  );

-- Admins can view all agricultural returns
CREATE POLICY "Admins can view all agricultural returns"
  ON public.agricultural_returns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 5. DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.documents (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES public.grant_applications(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Users can manage their own documents
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = documents.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = documents.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = documents.application_id
      AND user_id = auth.uid()
    )
  );

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 6. AGRICULTURAL FORM TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agricultural_form_templates (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  year INTEGER NOT NULL,
  sections JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on agricultural_form_templates
ALTER TABLE public.agricultural_form_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view active templates
CREATE POLICY "Users can view active templates"
  ON public.agricultural_form_templates FOR SELECT
  USING (is_active = TRUE OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Only admins can manage templates
CREATE POLICY "Admins can insert templates"
  ON public.agricultural_form_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update templates"
  ON public.agricultural_form_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete templates"
  ON public.agricultural_form_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 7. AGRICULTURAL FORM RESPONSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agricultural_form_responses (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES public.agricultural_form_templates(id),
  application_id INTEGER NOT NULL REFERENCES public.grant_applications(id),
  responses JSONB NOT NULL,
  is_complete BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on agricultural_form_responses
ALTER TABLE public.agricultural_form_responses ENABLE ROW LEVEL SECURITY;

-- Users can manage their own responses
CREATE POLICY "Users can view own responses"
  ON public.agricultural_form_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = agricultural_form_responses.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own responses"
  ON public.agricultural_form_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = agricultural_form_responses.application_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own responses"
  ON public.agricultural_form_responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_applications
      WHERE id = agricultural_form_responses.application_id
      AND user_id = auth.uid()
    )
  );

-- Admins can view all responses
CREATE POLICY "Admins can view all responses"
  ON public.agricultural_form_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 8. TRIGGER: Auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    'user' -- Default role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 9. PRE-SIGNUP HOOK: Enforce invitation requirement
-- ============================================
-- This function validates that a user has a valid invitation before allowing signup
CREATE OR REPLACE FUNCTION public.validate_invitation_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  invitation_token TEXT;
  invitation_record RECORD;
BEGIN
  -- Extract invitation_token from user metadata
  invitation_token := NEW.raw_user_meta_data->>'invitation_token';
  
  -- If no invitation token provided, check if user should be an admin
  -- (admins can be created manually in Supabase dashboard without invitations)
  IF invitation_token IS NULL THEN
    -- Only allow signup without invitation if explicitly marked as admin in metadata
    -- This allows manual admin creation through Supabase dashboard
    IF (NEW.raw_user_meta_data->>'role' = 'admin') THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Invitation required to sign up. Please contact an administrator.'
      USING HINT = 'invitation_required';
  END IF;
  
  -- Look up the invitation
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE token = invitation_token;
  
  -- Check if invitation exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token'
      USING HINT = 'invalid_invitation';
  END IF;
  
  -- Check if invitation is already used
  IF invitation_record.used = TRUE THEN
    RAISE EXCEPTION 'This invitation has already been used'
      USING HINT = 'invitation_already_used';
  END IF;
  
  -- Check if invitation is expired
  IF invitation_record.expires_at < NOW() THEN
    RAISE EXCEPTION 'This invitation has expired'
      USING HINT = 'invitation_expired';
  END IF;
  
  -- Check if email matches invitation
  IF invitation_record.email != NEW.email THEN
    RAISE EXCEPTION 'Email does not match invitation'
      USING HINT = 'email_mismatch';
  END IF;
  
  -- All checks passed, allow signup
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS validate_invitation_before_signup ON auth.users;

-- Create trigger that runs BEFORE insert on auth.users
-- This will run before Supabase creates the user account
CREATE TRIGGER validate_invitation_before_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invitation_on_signup();

-- ============================================
-- 10. INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_grant_applications_user_id ON public.grant_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_applications_status ON public.grant_applications(status);
CREATE INDEX IF NOT EXISTS idx_grant_applications_year ON public.grant_applications(year);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON public.documents(application_id);
CREATE INDEX IF NOT EXISTS idx_agricultural_returns_application_id ON public.agricultural_returns(application_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);

-- ============================================
-- 11. AGRICULTURAL RETURNS COLUMN ADDITIONS
-- (Run these if upgrading from initial schema)
-- ============================================
-- Add new columns to agricultural_returns table for form sections
ALTER TABLE public.agricultural_returns
  ADD COLUMN IF NOT EXISTS farm_details_data JSONB,
  ADD COLUMN IF NOT EXISTS accreditation_data JSONB,
  ADD COLUMN IF NOT EXISTS financial_data JSONB,
  ADD COLUMN IF NOT EXISTS facilities_data JSONB,
  ADD COLUMN IF NOT EXISTS livestock_data JSONB,
  ADD COLUMN IF NOT EXISTS management_plans JSONB,
  ADD COLUMN IF NOT EXISTS tier3_data JSONB,
  ADD COLUMN IF NOT EXISTS declaration_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS declaration_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS declaration_signature TEXT,
  ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_sections JSONB;
