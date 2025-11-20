-- Fix for infinite recursion in Row Level Security policies
-- Run this in your Supabase SQL Editor

-- ============================================
-- FIX USERS TABLE POLICIES
-- ============================================

-- Drop problematic policies on users table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;

-- Recreate admin policies using JWT instead of table lookup
-- This avoids infinite recursion

-- Admins can view all profiles (using JWT role)
CREATE POLICY "Admins can view all profiles"
  ON public.users FOR SELECT
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.users FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

-- Admins can insert users (for manual user creation)
CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

-- ============================================
-- FIX POLICIES ON OTHER TABLES
-- ============================================
-- Update all other tables that check admin role to use JWT

-- Fix invitations table policies
DROP POLICY IF EXISTS "Admins can view all invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can insert invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON public.invitations;

CREATE POLICY "Admins can view all invitations"
  ON public.invitations FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

-- Fix grant_applications policies
DROP POLICY IF EXISTS "Admins can view all applications" ON public.grant_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.grant_applications;

CREATE POLICY "Admins can view all applications"
  ON public.grant_applications FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can update applications"
  ON public.grant_applications FOR UPDATE
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

-- Fix agricultural_returns policies
DROP POLICY IF EXISTS "Admins can view all returns" ON public.agricultural_returns;
DROP POLICY IF EXISTS "Admins can update returns" ON public.agricultural_returns;

CREATE POLICY "Admins can view all returns"
  ON public.agricultural_returns FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can update returns"
  ON public.agricultural_returns FOR UPDATE
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

-- Fix documents policies
DROP POLICY IF EXISTS "Admins can view all documents" ON public.documents;

CREATE POLICY "Admins can view all documents"
  ON public.documents FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

-- Fix agricultural_form_templates policies
DROP POLICY IF EXISTS "Users can view active templates" ON public.agricultural_form_templates;
DROP POLICY IF EXISTS "Admins can insert templates" ON public.agricultural_form_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.agricultural_form_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.agricultural_form_templates;

CREATE POLICY "Users can view active templates"
  ON public.agricultural_form_templates FOR SELECT
  USING (is_active = TRUE OR (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can insert templates"
  ON public.agricultural_form_templates FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can update templates"
  ON public.agricultural_form_templates FOR UPDATE
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "Admins can delete templates"
  ON public.agricultural_form_templates FOR DELETE
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

-- Fix agricultural_form_responses policies
DROP POLICY IF EXISTS "Admins can view all responses" ON public.agricultural_form_responses;

CREATE POLICY "Admins can view all responses"
  ON public.agricultural_form_responses FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin');

-- Success message
SELECT 'All RLS policies have been fixed! The infinite recursion issue should be resolved.' as status;
