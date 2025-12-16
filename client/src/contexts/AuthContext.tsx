import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
    timeoutHandle = setTimeout(() => {
      reject(new Error('Query timeout'));
    }, timeoutMs);
    
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [profileFetchInProgress, setProfileFetchInProgress] = useState(false);

  const fetchUserProfile = useCallback(async (userId: string, background = false) => {
    // Prevent duplicate fetches
    if (profileFetchInProgress && background) return;
    
    if (!background) {
      setProfileFetchInProgress(true);
    }
    
    try {
      // Wrap with timeout to prevent indefinite waits
      const result = await withTimeout(
        (async () => {
          return await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        })(),
        5000 // 5 second timeout
      );

      if (result.error) {
        console.error('Error fetching user profile:', result.error);
        // Don't clear user on any fetch errors - keep existing state
        // User already has minimal profile from session data
        return;
      }

      if (result.data) {
        const profile: UserProfile = {
          id: result.data.id,
          email: result.data.email,
          firstName: result.data.first_name,
          lastName: result.data.last_name,
          role: result.data.role,
          profileImageUrl: result.data.profile_image_url,
        };
        setUser(profile);
        setCachedProfile(userId, profile);
      }
    } catch (error: any) {
      if (error.message === 'Query timeout') {
        console.warn('Profile fetch timed out, using existing data');
      } else {
        console.error('Error in fetchUserProfile:', error);
      }
      // Don't clear user on errors - keep existing state
    } finally {
      if (!background) {
        setProfileFetchInProgress(false);
      }
    }
  }, [profileFetchInProgress]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Wrap getSession with timeout to prevent indefinite waits
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          5000 // 5 second timeout
        );
        
        const { data: { session }, error } = sessionResult;
        
        if (!mounted) return;
        
        // Check for fatal auth errors
        if (error && isFatalAuthError(error)) {
          setIsLoading(false);
          await handleFatalAuthError();
          return;
        }
        
        if (session?.user) {
          setSupabaseUser(session.user);
          
          // Immediately use cached profile if available - don't wait for network
          const cached = getCachedProfile(session.user.id);
          if (cached) {
            setUser(cached);
            // Refresh in background (non-blocking)
            fetchUserProfile(session.user.id, true);
          } else {
            // No cache - create minimal profile from session data for immediate use
            const minimalProfile: UserProfile = {
              id: session.user.id,
              email: session.user.email ?? null,
              firstName: null,
              lastName: null,
              role: null, // Will be fetched
              profileImageUrl: null,
            };
            setUser(minimalProfile);
            // Fetch full profile in background
            fetchUserProfile(session.user.id, true);
          }
        } else {
          setUser(null);
          setSupabaseUser(null);
          clearCachedProfile();
        }
      } catch (error: any) {
        console.error('Error initializing auth:', error);
        if (isFatalAuthError(error)) {
          setIsLoading(false);
          await handleFatalAuthError();
          return;
        }
        if (mounted) {
          setUser(null);
          setSupabaseUser(null);
        }
      } finally {
        // Always ensure loading is set to false
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      try {
        if (event === 'SIGNED_OUT') {
          clearCachedProfile();
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
          return;
        }
        
        if (session?.user) {
          setSupabaseUser(session.user);
          
          if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            // Use cache for token refresh, fetch in background
            const cached = getCachedProfile(session.user.id);
            if (cached) {
              setUser(cached);
            }
            fetchUserProfile(session.user.id, true);
          } else if (event === 'SIGNED_IN') {
            // Fresh sign in - fetch profile but don't block
            const cached = getCachedProfile(session.user.id);
            if (cached) {
              setUser(cached);
            } else {
              // Minimal profile from session
              setUser({
                id: session.user.id,
                email: session.user.email ?? null,
                firstName: null,
                lastName: null,
                role: null,
                profileImageUrl: null,
              });
            }
            fetchUserProfile(session.user.id, false);
          } else {
            // USER_UPDATED or other events
            fetchUserProfile(session.user.id, false);
          }
        } else {
          setUser(null);
          setSupabaseUser(null);
          clearCachedProfile();
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const refetchUser = useCallback(async () => {
    if (supabaseUser) {
      await fetchUserProfile(supabaseUser.id, false);
    }
  }, [supabaseUser, fetchUserProfile]);

  const value: AuthContextType = {
    user,
    supabaseUser,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    refetchUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
