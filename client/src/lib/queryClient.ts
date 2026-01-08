import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase, isFatalAuthError, handleFatalAuthError } from "./supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    cachedAccessToken = session.access_token;
    tokenExpiresAt = session.expires_at ? session.expires_at * 1000 : null;
  } else {
    cachedAccessToken = null;
    tokenExpiresAt = null;
  }
});

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  
  const now = Date.now();
  const tokenExpired = tokenExpiresAt && now >= tokenExpiresAt - 60000;
  
  if (cachedAccessToken && !tokenExpired) {
    headers['Authorization'] = `Bearer ${cachedAccessToken}`;
    return headers;
  }
  
  // Add timeout protection for getSession to prevent long waits
  // Use 5s timeout - Supabase can be slow in some regions
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
    );
    
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    
    // Only check for explicit fatal auth errors (not timeouts or network issues)
    if (result && 'error' in result && result.error && isFatalAuthError(result.error)) {
      await handleFatalAuthError();
      return headers;
    }
    
    if (result && 'data' in result && result.data.session?.access_token) {
      cachedAccessToken = result.data.session.access_token;
      tokenExpiresAt = result.data.session.expires_at ? result.data.session.expires_at * 1000 : null;
      headers['Authorization'] = `Bearer ${result.data.session.access_token}`;
    } else if (cachedAccessToken) {
      // No new session but we have a cached token - use it anyway
      // This handles cases where getSession returns null but token might still be valid
      headers['Authorization'] = `Bearer ${cachedAccessToken}`;
    }
  } catch (error: any) {
    // Only trigger logout for explicit auth errors, NOT for timeouts or network issues
    if (isFatalAuthError(error)) {
      await handleFatalAuthError();
      return headers;
    }
    
    // Timeouts and network errors: keep using cached token, don't log out
    console.warn('Session refresh timed out or failed, continuing with cached token');
    if (cachedAccessToken) {
      headers['Authorization'] = `Bearer ${cachedAccessToken}`;
    }
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    
    const res = await fetch(queryKey[0] as string, {
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// In-memory cache for API responses
const responseCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache TTL

export function getCachedData<T>(key: string): T | null {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

export function setCachedData(key: string, data: unknown): void {
  responseCache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(keyPrefix?: string): void {
  if (keyPrefix) {
    Array.from(responseCache.keys()).forEach(key => {
      if (key.startsWith(keyPrefix)) {
        responseCache.delete(key);
      }
    });
  } else {
    responseCache.clear();
  }
}

// Helper function to download files with authentication
export async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const authHeaders = await getAuthHeaders();
  
  const response = await fetch(url, {
    headers: authHeaders,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Download failed: ${response.status} - ${text}`);
  }
  
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

// Helper function to view files in new tab with authentication
export async function viewWithAuth(url: string): Promise<void> {
  const authHeaders = await getAuthHeaders();
  
  const response = await fetch(url, {
    headers: authHeaders,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`View failed: ${response.status} - ${text}`);
  }
  
  const blob = await response.blob();
  const viewUrl = window.URL.createObjectURL(blob);
  window.open(viewUrl, '_blank');
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // Data stays fresh for 30 seconds
      gcTime: 300000, // Keep unused data in cache for 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
