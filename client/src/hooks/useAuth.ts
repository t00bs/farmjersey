import { useEffect, useState } from 'react';
import { supabase, isFatalAuthError, handleFatalAuthError } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  profileImageUrl: string | null;
}

const PROFILE_CACHE_KEY = 'user_profile_cache';
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedProfile(userId: string): UserProfile | null {
  try {
    const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;
    
    const { profile, userId: cachedUserId, timestamp } = JSON.parse(cached);
    
    if (cachedUserId !== userId) return null;
    if (Date.now() - timestamp > PROFILE_CACHE_TTL) {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }
    
    return profile;
  } catch {
    return null;
  }
}

function setCachedProfile(userId: string, profile: UserProfile): void {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      profile,
      userId,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore storage errors
  }
}

function clearCachedProfile(): void {
  try {
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
}

// Timeout wrapper to prevent queries from hanging indefinitely
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  return new Promise<T>((resolve, reject) => {
    // Set up timeout
    timeoutHandle = setTimeout(() => {
      reject(new Error('Query timeout'));
    }, timeoutMs);
    
    // Wrap original promise to clear timeout on completion
    promise
      .then((result) => {
        clearTimeout(timeoutHandle);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Check for fatal auth errors (e.g., refresh_token_not_found)
        if (error && isFatalAuthError(error)) {
          await handleFatalAuthError();
          return;
        }
        
        if (session?.user) {
          setSupabaseUser(session.user);
          
          // Try to use cached profile first for faster initial load
          const cached = getCachedProfile(session.user.id);
          if (cached) {
            setUser(cached);
            setIsLoading(false);
            // Refresh in background
            fetchUserProfile(session.user.id);
          } else {
            await fetchUserProfile(session.user.id);
          }
        } else {
          setUser(null);
          setSupabaseUser(null);
          clearCachedProfile();
        }
      } catch (error: any) {
        console.error('Error initializing auth:', error);
        // Check for fatal auth errors
        if (isFatalAuthError(error)) {
          await handleFatalAuthError();
          return;
        }
        setUser(null);
        setSupabaseUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          setSupabaseUser(session.user);
          
          // On sign out, clear cache
          if (event === 'SIGNED_OUT') {
            clearCachedProfile();
            setUser(null);
            setSupabaseUser(null);
          } else if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            // For token refresh and initial session, skip network call if cache is fresh
            await fetchUserProfile(session.user.id, 0, true);
          } else {
            // For other events like SIGNED_IN, USER_UPDATED, fetch fresh data
            await fetchUserProfile(session.user.id);
          }
        } else {
          setUser(null);
          setSupabaseUser(null);
          clearCachedProfile();
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
        setSupabaseUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(userId: string, retryCount = 0, skipIfCached = false) {
    const maxRetries = 2;
    
    // If skipIfCached is true and we have a fresh cache, skip the network call
    if (skipIfCached) {
      const cached = getCachedProfile(userId);
      if (cached) {
        setUser(cached);
        return;
      }
    }
    
    try {
      // Wrap the query with a 10-second timeout
      const { data, error } = await withTimeout(
        Promise.resolve(
          supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()
        ),
        10000
      );

      if (error) {
        console.error('Error fetching user profile:', error);
        // On error, retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log(`Retrying profile fetch (attempt ${retryCount + 2}/${maxRetries + 1})...`);
          return fetchUserProfile(userId, retryCount + 1);
        }
        setUser(null);
        return;
      }

      if (data) {
        const profile: UserProfile = {
          id: data.id,
          email: data.email,
          firstName: data.first_name,
          lastName: data.last_name,
          role: data.role,
          profileImageUrl: data.profile_image_url,
        };
        setUser(profile);
        setCachedProfile(userId, profile);
      }
    } catch (error: any) {
      if (error.message === 'Query timeout') {
        console.warn('Profile fetch timed out after 10 seconds. This may indicate a connection issue with Supabase.');
        // On timeout, retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log(`Retrying profile fetch after timeout (attempt ${retryCount + 2}/${maxRetries + 1})...`);
          return fetchUserProfile(userId, retryCount + 1);
        }
      } else {
        console.error('Error in fetchUserProfile:', error);
      }
      // Only set user to null after all retries are exhausted
      setUser(null);
    }
  }

  async function refetchUser() {
    if (supabaseUser) {
      await fetchUserProfile(supabaseUser.id);
    }
  }

  return {
    user,
    supabaseUser,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    refetchUser,
  };
}
