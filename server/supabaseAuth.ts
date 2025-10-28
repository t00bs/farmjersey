import type { Request, Response, NextFunction } from 'express';
import { getUserFromToken, getUserRole, supabaseAdmin } from './supabase';

// Define custom user interface for Supabase auth
export interface SupabaseUser {
  id: string;
  email?: string;
  role?: string;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      role?: string;
    }
  }
}

// Middleware to authenticate requests using Supabase JWT
export async function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authorization token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token and get user
    const user = await getUserFromToken(token);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Get user role from database
    const role = await getUserRole(user.id);
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: role || 'user',
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
}

// Middleware to check if user is admin
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const role = (req.user as SupabaseUser).role;
  
  if (role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }

  next();
}

// Helper function to validate invitation token
export async function validateInvitationToken(token: string): Promise<{
  valid: boolean;
  email?: string;
  invitationId?: number;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (error || !data) {
      return { valid: false };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now > expiresAt) {
      return { valid: false };
    }

    return {
      valid: true,
      email: data.email,
      invitationId: data.id,
    };
  } catch (error) {
    console.error('Error validating invitation:', error);
    return { valid: false };
  }
}

// Helper function to mark invitation as used
export async function markInvitationUsed(invitationId: number, userId: string) {
  try {
    await supabaseAdmin
      .from('invitations')
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq('id', invitationId);
  } catch (error) {
    console.error('Error marking invitation as used:', error);
  }
}
