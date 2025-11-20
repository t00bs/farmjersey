import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  profileImageUrl: string | null;
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
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setSupabaseUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setSupabaseUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
        setSupabaseUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          setSupabaseUser(session.user);
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setSupabaseUser(null);
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

  async function fetchUserProfile(userId: string) {
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
        setUser(null);
        return;
      }

      if (data) {
        setUser({
          id: data.id,
          email: data.email,
          firstName: data.first_name,
          lastName: data.last_name,
          role: data.role,
          profileImageUrl: data.profile_image_url,
        });
      }
    } catch (error: any) {
      if (error.message === 'Query timeout') {
        console.warn('Profile fetch timed out after 10 seconds. This may indicate a connection issue with Supabase.');
      } else {
        console.error('Error in fetchUserProfile:', error);
      }
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
