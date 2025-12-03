import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

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
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
    );
    
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    
    if (result && 'data' in result && result.data.session?.access_token) {
      cachedAccessToken = result.data.session.access_token;
      tokenExpiresAt = result.data.session.expires_at ? result.data.session.expires_at * 1000 : null;
      headers['Authorization'] = `Bearer ${result.data.session.access_token}`;
    }
  } catch (error) {
    console.warn('Auth headers fetch timed out or failed, using cached token if available');
    // If we have an expired cached token, still try to use it
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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
