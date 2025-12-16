import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Fatal auth error codes that require full sign-out
const FATAL_AUTH_ERRORS = [
  'refresh_token_not_found',
  'invalid_refresh_token', 
  'refresh_token_already_used',
  'session_not_found',
  'invalid_grant'
];

// Helper to check if an error is a fatal auth error
export function isFatalAuthError(error: any): boolean {
  if (!error) return false;
  const errorCode = error?.code || error?.error_code || '';
  const errorMessage = error?.message || '';
  return FATAL_AUTH_ERRORS.some(code => 
    errorCode.includes(code) || errorMessage.includes(code)
  );
}

// Helper to clear all auth state and redirect to login
export async function handleFatalAuthError(): Promise<void> {
  console.warn('Fatal auth error detected, clearing session and redirecting to login...');
  
  // Clear session storage cache
  try {
    sessionStorage.removeItem('user_profile_cache');
  } catch {
    // Ignore storage errors
  }
  
  // Sign out from Supabase (this clears localStorage tokens)
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // If sign out fails, manually clear localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignore storage errors
    }
  }
  
  // Redirect to auth page with session expired message
  if (window.location.pathname !== '/auth') {
    window.location.href = '/auth?session_expired=true';
  }
}

// Global auth error listener - catches refresh token failures
supabase.auth.onAuthStateChange((event, session) => {
  // The auth state change itself doesn't give us the error directly,
  // but if we get a SIGNED_OUT event unexpectedly, it could be due to token failure
  if (event === 'SIGNED_OUT' && !session) {
    // This is fine - user signed out normally
  }
});

// Override error handling for auth operations
const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
supabase.auth.getSession = async function() {
  try {
    const result = await originalGetSession();
    if (result.error && isFatalAuthError(result.error)) {
      await handleFatalAuthError();
    }
    return result;
  } catch (error: any) {
    if (isFatalAuthError(error)) {
      await handleFatalAuthError();
    }
    throw error;
  }
};

// Helper to get current session
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Helper to get current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Helper to sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
