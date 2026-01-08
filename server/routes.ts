import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated, isAdmin, validateInvitationToken, markInvitationUsed } from "./supabaseAuth";
import { insertGrantApplicationSchema, insertAgriculturalReturnSchema, insertDocumentSchema, insertInvitationSchema, passwordResetTokens } from "@shared/schema";
import { sendInvitationEmail, sendPasswordResetEmail } from "./resend";
import { eq, and, gt } from "drizzle-orm";
import { db } from "./db";
import { randomBytes, createHash } from "crypto";
import rateLimit from "express-rate-limit";
import { generateFilledPDF } from "./pdf-generator";

// Hash tokens before storing for security (protects against DB leaks)
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Sensitive fields that should be redacted from logs
const SENSITIVE_FIELDS = ['password', 'token', 'signature', 'signatureData', 'authorization', 'cookie', 'api_key', 'apiKey', 'secret', 'accessToken', 'refreshToken', 'jwt', 'bearer'];

// Redact sensitive data from objects before logging
// This function recursively traverses objects and arrays to find and redact sensitive fields
function sanitizeForLogging(data: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]';
  }
  
  if (data === null || data === undefined) {
    return data;
  }
  
  // For strings, search and replace tokens/secrets that may be embedded anywhere in the string
  if (typeof data === 'string') {
    let sanitized = data;
    // Replace JWT tokens anywhere in the string
    sanitized = sanitized.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[JWT_REDACTED]');
    // Replace long hex strings (32+ chars, likely tokens) anywhere in the string
    sanitized = sanitized.replace(/\b[a-f0-9]{32,}\b/gi, '[TOKEN_REDACTED]');
    // Replace Bearer tokens (match any non-whitespace sequence after Bearer to handle base64 chars like +, /, =)
    sanitized = sanitized.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
    // Replace Basic auth tokens
    sanitized = sanitized.replace(/Basic\s+\S+/gi, 'Basic [REDACTED]');
    // Replace full Authorization header values (everything after "Authorization:" to end of line or string)
    sanitized = sanitized.replace(/Authorization[:\s]+[^\n\r]*/gi, 'Authorization: [REDACTED]');
    return sanitized;
  }
  
  if (typeof data !== 'object') {
    return data;
  }
  
  // Handle Error objects specially
  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeForLogging(data.message, depth + 1),
      stack: data.stack?.split('\n').slice(0, 3).join('\n') + '...',
    };
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item, depth + 1));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    // Check if key contains any sensitive field name
    if (SENSITIVE_FIELDS.some(field => keyLower.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Safe logging function that redacts sensitive data
function secureLog(level: 'log' | 'error' | 'warn', message: string, data?: any): void {
  const sanitizedData = data ? sanitizeForLogging(data) : undefined;
  if (sanitizedData !== undefined) {
    console[level](message, sanitizedData);
  } else {
    console[level](message);
  }
}

// Validate password strength: 8+ chars, at least one letter and one number
function validatePassword(password: string): { valid: boolean; message: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true, message: '' };
}
import multer from "multer";
import path from "path";
import fs from "fs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import memoizee from "memoizee";

// Server-side cache for user data (5 minute TTL)
const userCache = new Map<string, { data: any; timestamp: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedUser(userId: string) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedUser(userId: string, data: any) {
  userCache.set(userId, { data, timestamp: Date.now() });
}

function invalidateUserCache(userId: string) {
  userCache.delete(userId);
}
import { ensureBucketExists, uploadFile, downloadFile, deleteFile, deleteMultipleFiles, getSignedUrl, isSupabasePath } from "./supabaseStorage";

// Helper function to prevent CSV/XLSX formula injection
const sanitizeForExport = (value: any): string => {
  const str = String(value);
  // If string starts with formula characters (with optional leading whitespace), prefix with single quote
  if (str.match(/^[\t\r\n\s]*[=+\-@]/)) {
    return `'${str}`;
  }
  return str;
};

// Configure multer for file uploads - use memory storage for Supabase upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images, PDFs, and Office documents are allowed"));
    }
  },
});

// Rate limiters for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs for sensitive auth actions
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit to 5 password reset requests per hour per IP
  message: { message: 'Too many password reset requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});


export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Supabase Storage bucket
  await ensureBucketExists();
  
  // Invitation validation endpoints (no auth required)
  app.get('/api/validate-invitation', async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: 'Token is required' });
      }

      const result = await validateInvitationToken(token);
      res.json(result);
    } catch (error) {
      secureLog('error', 'Error validating invitation:', error);
      res.status(500).json({ valid: false, message: 'Failed to validate invitation' });
    }
  });

  app.post('/api/use-invitation', async (req, res) => {
    try {
      const { token, userId } = req.body;
      
      if (!token || !userId) {
        return res.status(400).json({ message: 'Token and userId are required' });
      }

      // Validate the invitation token
      const validation = await validateInvitationToken(token);
      if (!validation.valid || !validation.invitationId || !validation.email) {
        return res.status(400).json({ message: 'Invalid invitation token' });
      }

      // Fetch the user from Supabase to verify they exist and get their email
      const { supabaseAdmin } = await import('./supabase');
      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (userError || !user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // CRITICAL SECURITY CHECK: Verify the user's email matches the invitation email
      if (user.email !== validation.email) {
        console.warn(`Invitation email mismatch: user ${user.email} tried to use invitation for ${validation.email}`);
        return res.status(403).json({ message: 'Email does not match invitation' });
      }

      // Mark invitation as used with the verified user ID
      await markInvitationUsed(validation.invitationId, userId);
      res.json({ message: 'Invitation marked as used' });
    } catch (error) {
      secureLog('error', 'Error using invitation:', error);
      res.status(500).json({ message: 'Failed to mark invitation as used' });
    }
  });

  // Password reset endpoints (no auth required) - with rate limiting
  app.post('/api/forgot-password', forgotPasswordRateLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Check if user exists using Supabase RPC function (queries auth.users directly)
      // This is more reliable than listUsers() which can fail with pagination issues
      const { supabaseAdmin } = await import('./supabase');
      const { data: userData, error: userError } = await supabaseAdmin.rpc('get_user_id_by_email', {
        user_email: email.toLowerCase()
      });
      
      if (userError) {
        secureLog('error', 'Error checking user by email:', userError);
      }
      
      // Always return success to prevent email enumeration
      // but only send email if user exists
      if (userData && userData.length > 0 && !userError) {
        // Generate secure token
        const token = randomBytes(32).toString('hex');
        const hashedToken = hashToken(token); // Hash before storing for security
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
        
        // Store HASHED token in database (protects against DB leaks)
        await db.insert(passwordResetTokens).values({
          email: email.toLowerCase(),
          token: hashedToken,
          expiresAt,
          used: false,
        });

        // Build the reset URL using the request host (send plain token in email)
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
        const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;
        
        // Send email via Resend
        try {
          await sendPasswordResetEmail(email, resetUrl);
          console.log(`Password reset email sent to ${email}`);
        } catch (emailError) {
          secureLog('error', 'Error sending password reset email:', emailError);
          // Don't fail the request - we still want to return success
        }
      } else {
        console.log(`Password reset requested for non-existent email: ${email}`);
      }

      // Always return success to prevent email enumeration attacks
      res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    } catch (error) {
      secureLog('error', 'Error in forgot-password:', error);
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  });

  app.get('/api/validate-reset-token', authRateLimiter, async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.json({ valid: false, message: 'Token is required' });
      }

      // Hash the incoming token to compare with stored hash
      const hashedToken = hashToken(token);

      // Find the token in database
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, hashedToken),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!resetToken) {
        return res.json({ valid: false, message: 'Invalid or expired token' });
      }

      res.json({ valid: true, email: resetToken.email });
    } catch (error) {
      secureLog('error', 'Error validating reset token:', error);
      res.status(500).json({ valid: false, message: 'Failed to validate token' });
    }
  });

  app.post('/api/reset-password', authRateLimiter, async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Token is required' });
      }
      
      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      // Hash the incoming token to compare with stored hash
      const hashedToken = hashToken(token);

      // Find and validate the token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, hashedToken),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!resetToken) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      // Find user by email using RPC function (more reliable than listUsers)
      const { supabaseAdmin } = await import('./supabase');
      const { data: userData, error: userError } = await supabaseAdmin.rpc('get_user_id_by_email', {
        user_email: resetToken.email.toLowerCase()
      });
      
      if (userError || !userData || userData.length === 0) {
        secureLog('error', 'Error finding user by email:', userError);
        return res.status(404).json({ message: 'User not found' });
      }

      const userId = userData[0].id;

      // Update password in Supabase
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (updateError) {
        secureLog('error', 'Error updating password:', updateError);
        return res.status(500).json({ message: 'Failed to update password' });
      }

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true, usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      console.log(`Password reset completed for ${resetToken.email}`);
      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      secureLog('error', 'Error in reset-password:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      secureLog('error', 'Error fetching user:', error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile routes
  app.patch('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName } = req.body;
      
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      
      // Update user profile
      const updatedUser = await storage.upsertUser({
        id: userId,
        ...updates,
      });
      
      res.json(updatedUser);
    } catch (error) {
      secureLog('error', 'Error updating user profile:', error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.delete('/api/user/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { supabaseAdmin } = await import('./supabase');
      
      // Delete all user's grant applications and related data
      const applications = await storage.getUserGrantApplications(userId);
      
      for (const application of applications) {
        // Delete all documents for this application
        const documents = await storage.getDocumentsByApplicationId(application.id);
        const supabasePaths: string[] = [];
        
        for (const doc of documents) {
          if (doc.filePath) {
            if (isSupabasePath(doc.filePath)) {
              // Collect Supabase paths for batch deletion
              supabasePaths.push(doc.filePath);
            } else if (fs.existsSync(doc.filePath)) {
              // Delete local file
              try {
                fs.unlinkSync(doc.filePath);
              } catch (err) {
                console.error("Failed to delete document file:", err);
              }
            }
          }
          await storage.deleteDocument(doc.id);
        }
        
        // Delete all Supabase Storage files in batch
        if (supabasePaths.length > 0) {
          const { error: deleteError } = await deleteMultipleFiles(supabasePaths);
          if (deleteError) {
            console.error("Failed to delete Supabase files:", deleteError);
          }
        }
        
        // Delete application
        await storage.deleteGrantApplication(application.id);
      }
      
      // Delete user from Supabase Auth (this will cascade to public.users via ON DELETE CASCADE)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (error) {
        secureLog('error', 'Error deleting user from Supabase:', error);
        return res.status(500).json({ message: "Failed to delete account" });
      }
      
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      secureLog('error', 'Error deleting user account:', error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Admin routes
  app.get("/api/admin/applications", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, startDate, endDate, page, limit } = req.query;
      
      // Parse pagination parameters
      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Max 100 per page
      
      // Parse date parameters
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? (() => {
        const date = new Date(endDate as string);
        // Set to end of day to include the full selected day
        date.setHours(23, 59, 59, 999);
        return date;
      })() : undefined;
      
      // Validate date parameters
      if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({ message: "Invalid startDate format" });
      }
      
      if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ message: "Invalid endDate format" });
      }
      
      // Use paginated method for better performance
      const result = await storage.getGrantApplicationsWithUserDataPaginated({
        status: status && status !== 'all' ? status as string : undefined,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        page: pageNum,
        limit: limitNum,
      });
      
      // Add cache control for browser caching (shorter for admin data)
      res.set('Cache-Control', 'private, max-age=15');
      res.json(result);
    } catch (error) {
      console.error("Error fetching admin applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.patch("/api/admin/applications/:id/status", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['draft', 'in_progress', 'submitted', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedApplication = await storage.updateGrantApplication(parseInt(id), { 
        status,
        ...(status === 'submitted' ? { submittedAt: new Date() } : {})
      });
      
      if (!updatedApplication) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      res.json(updatedApplication);
    } catch (error) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  // Export applications to CSV
  app.get("/api/admin/applications/export/csv", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, startDate, endDate } = req.query;
      
      // Parse date parameters
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? (() => {
        const date = new Date(endDate as string);
        date.setHours(23, 59, 59, 999);
        return date;
      })() : undefined;
      
      if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({ message: "Invalid startDate format" });
      }
      
      if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ message: "Invalid endDate format" });
      }
      
      const applications = await storage.getGrantApplicationsWithUserDataFiltered(
        status && status !== 'all' ? status as string : undefined,
        parsedStartDate,
        parsedEndDate
      );
      
      const applicationIds = applications.map(app => app.id);
      
      // Fetch agricultural returns (new table) and documents in bulk
      const [agriculturalReturns, documents] = await Promise.all([
        storage.getAgriculturalReturnsForApplications(applicationIds),
        storage.getDocumentsForApplications(applicationIds)
      ]);
      
      // Create lookup maps
      const returnMap = new Map();
      agriculturalReturns.forEach(ar => {
        returnMap.set(ar.applicationId, ar);
      });
      
      const documentsMap = new Map();
      documents.forEach(doc => {
        if (!documentsMap.has(doc.applicationId)) {
          documentsMap.set(doc.applicationId, []);
        }
        documentsMap.get(doc.applicationId).push(doc);
      });
      
      const getDocumentUrl = (doc: any) => {
        const baseUrl = req.protocol + '://' + req.get('host');
        return `${baseUrl}/api/documents/download/${doc.id}`;
      };
      
      // Helper to flatten JSONB fields for CSV
      const flattenObject = (obj: any, prefix: string = ''): Record<string, string> => {
        const result: Record<string, string> = {};
        if (!obj || typeof obj !== 'object') return result;
        
        for (const [key, value] of Object.entries(obj)) {
          const fieldName = prefix ? `${prefix}_${key}` : key;
          if (value === null || value === undefined) {
            result[fieldName] = '';
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, fieldName));
          } else if (Array.isArray(value)) {
            result[fieldName] = value.join('; ');
          } else {
            result[fieldName] = String(value);
          }
        }
        return result;
      };
      
      // Collect all unique field names from agricultural returns
      const allFields = new Set<string>();
      agriculturalReturns.forEach(ar => {
        const farmDetails = flattenObject(ar.farmDetailsData, 'FarmDetails');
        const accreditation = flattenObject((ar as any).accreditationData, 'Accreditation');
        const financial = flattenObject(ar.financialData, 'Financial');
        const facilities = flattenObject(ar.facilitiesData, 'Facilities');
        const livestock = flattenObject(ar.livestockData, 'Livestock');
        const management = flattenObject(ar.managementPlans, 'Management');
        const tier3 = flattenObject(ar.tier3Data, 'Tier3');
        
        Object.keys(farmDetails).forEach(k => allFields.add(k));
        Object.keys(accreditation).forEach(k => allFields.add(k));
        Object.keys(financial).forEach(k => allFields.add(k));
        Object.keys(facilities).forEach(k => allFields.add(k));
        Object.keys(livestock).forEach(k => allFields.add(k));
        Object.keys(management).forEach(k => allFields.add(k));
        Object.keys(tier3).forEach(k => allFields.add(k));
      });
      
      const sortedFields = Array.from(allFields).sort();
      
      // Helper to format application reference number
      const formatApplicationRef = (year: number, id: number): string => {
        const paddedId = id.toString().padStart(4, '0');
        return `RSS-${year}-${paddedId}`;
      };
      
      // Generate CSV headers
      const baseHeaders = [
        'Reference',
        'ID',
        'User ID',
        'First Name',
        'Last Name',
        'Email',
        'Status',
        'Year',
        'Progress (%)',
        'Agricultural Return Completed',
        'Land Declaration Completed',
        'Consent Form Completed',
        'Supporting Docs Completed',
        'Created At',
        'Submitted At',
        'Declaration Name',
        'Declaration Date',
        'Declaration Has Signature'
      ];
      
      const documentHeaders = [
        'Land Declaration Documents',
        'Supporting Documents',
        'All Document URLs'
      ];
      
      const headers = [...baseHeaders, ...sortedFields, ...documentHeaders];
      
      // Convert applications to CSV format
      const csvData = applications.map(app => {
        const ar = returnMap.get(app.id);
        const appDocuments = documentsMap.get(app.id) || [];
        
        // Flatten all agricultural return sections
        let flatData: Record<string, string> = {};
        if (ar) {
          flatData = {
            ...flattenObject(ar.farmDetailsData, 'FarmDetails'),
            ...flattenObject((ar as any).accreditationData, 'Accreditation'),
            ...flattenObject(ar.financialData, 'Financial'),
            ...flattenObject(ar.facilitiesData, 'Facilities'),
            ...flattenObject(ar.livestockData, 'Livestock'),
            ...flattenObject(ar.managementPlans, 'Management'),
            ...flattenObject(ar.tier3Data, 'Tier3'),
          };
        }
        
        const fieldValues = sortedFields.map(field => sanitizeForExport(flatData[field] || ''));
        
        const landDeclarationDocs = appDocuments
          .filter((doc: any) => doc.documentType === 'land_declaration')
          .map((doc: any) => `${doc.fileName} (${getDocumentUrl(doc)})`)
          .join('; ');
          
        const supportingDocs = appDocuments
          .filter((doc: any) => doc.documentType === 'supporting_doc')
          .map((doc: any) => `${doc.fileName} (${getDocumentUrl(doc)})`)
          .join('; ');
          
        const allDocs = appDocuments
          .map((doc: any) => `${doc.fileName} (${getDocumentUrl(doc)})`)
          .join('; ');
        
        return [
          formatApplicationRef(app.year, app.id),
          app.id,
          sanitizeForExport(app.userId),
          sanitizeForExport(app.userFirstName || ''),
          sanitizeForExport(app.userLastName || ''),
          sanitizeForExport(app.userEmail || ''),
          app.status,
          app.year,
          app.progressPercentage || 0,
          app.agriculturalReturnCompleted ? 'Yes' : 'No',
          app.landDeclarationCompleted ? 'Yes' : 'No',
          app.consentFormCompleted ? 'Yes' : 'No',
          app.supportingDocsCompleted ? 'Yes' : 'No',
          app.createdAt ? new Date(app.createdAt).toISOString() : '',
          app.submittedAt ? new Date(app.submittedAt).toISOString() : '',
          sanitizeForExport(ar?.declarationName || ''),
          ar?.declarationDate ? new Date(ar.declarationDate).toISOString() : '',
          ar?.declarationSignature ? 'Yes' : 'No',
          ...fieldValues,
          sanitizeForExport(landDeclarationDocs),
          sanitizeForExport(supportingDocs),
          sanitizeForExport(allDocs)
        ];
      });
      
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `applications-detailed-${timestamp}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
      
    } catch (error) {
      console.error("Error exporting applications to CSV:", error);
      res.status(500).json({ message: "Failed to export applications" });
    }
  });

  // Admin-only route to get documents for any application
  app.get("/api/admin/applications/:applicationId/documents", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      
      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      
      // Admin can access documents for any application
      const documents = await storage.getDocumentsByApplicationId(applicationId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching application documents for admin:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Admin endpoint to get agricultural return data for an application
  app.get("/api/admin/applications/:applicationId/agricultural-return", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      
      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      
      const agriculturalReturn = await storage.getAgriculturalReturnByApplicationId(applicationId);
      res.json(agriculturalReturn || null);
    } catch (error) {
      console.error("Error fetching agricultural return for admin:", error);
      res.status(500).json({ message: "Failed to fetch agricultural return" });
    }
  });

  // Admin-only document download route for CSV links
  app.get("/api/documents/download/:documentId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      
      if (!Number.isInteger(documentId) || documentId <= 0) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if file is stored in Supabase or locally
      if (isSupabasePath(document.filePath)) {
        // Download from Supabase Storage
        const { data: fileData, error: downloadError } = await downloadFile(document.filePath);
        
        if (downloadError || !fileData) {
          console.error(`Failed to download from Supabase: ${document.filePath}`, downloadError);
          return res.status(404).json({ message: "File not found in storage" });
        }
        
        res.setHeader('Content-Type', document.fileType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.setHeader('Content-Length', fileData.length);
        res.send(fileData);
      } else {
        // Legacy: Download from local filesystem
        if (!fs.existsSync(document.filePath)) {
          return res.status(404).json({ message: "File not found on server" });
        }
        
        res.setHeader('Content-Type', document.fileType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.download(document.filePath, document.fileName);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Admin-only document view route - serves file inline for viewing in browser
  app.get("/api/documents/view/:documentId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      
      if (!Number.isInteger(documentId) || documentId <= 0) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if file is stored in Supabase or locally
      if (isSupabasePath(document.filePath)) {
        // Download from Supabase Storage and serve inline
        const { data: fileData, error: downloadError } = await downloadFile(document.filePath);
        
        if (downloadError || !fileData) {
          console.error(`Failed to download from Supabase: ${document.filePath}`, downloadError);
          return res.status(404).json({ message: "File not found in storage" });
        }
        
        res.setHeader('Content-Type', document.fileType);
        res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
        res.setHeader('Content-Length', fileData.length);
        res.send(fileData);
      } else {
        // Legacy: Serve from local filesystem
        if (!fs.existsSync(document.filePath)) {
          return res.status(404).json({ message: "File not found on server" });
        }
        
        res.setHeader('Content-Type', document.fileType);
        res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
        res.sendFile(path.resolve(document.filePath));
      }
    } catch (error) {
      console.error("Error viewing document:", error);
      res.status(500).json({ message: "Failed to view document" });
    }
  });

  // Invitation routes
  // Create invitation (admin only)
  app.post("/api/admin/invitations", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      // Generate secure random token
      const token = randomBytes(32).toString('hex');
      
      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitationData = insertInvitationSchema.parse({
        email,
        token,
        used: false,
        expiresAt,
        createdBy: req.user.id,
      });

      const invitation = await storage.createInvitation(invitationData);

      // Generate invitation URL
      const baseUrl = req.protocol + '://' + req.get('host');
      const invitationUrl = `${baseUrl}/api/accept-invitation?token=${token}`;

      // Send invitation email
      try {
        await sendInvitationEmail(email, invitationUrl);
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
        // Delete the invitation if email fails
        await storage.deleteInvitation(invitation.id);
        return res.status(500).json({ message: "Failed to send invitation email" });
      }

      res.json({ 
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        }
      });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // Get all invitations (admin only)
  app.get("/api/admin/invitations", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const invitations = await storage.getInvitations();
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Delete invitation (admin only)
  app.delete("/api/admin/invitations/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }

      await storage.deleteInvitation(id);
      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  // Get all users (admin only)
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user role (admin only)
  app.patch("/api/admin/users/:id/role", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'admin' or 'user'" });
      }
      
      // Prevent admin from demoting themselves
      if (id === req.user.id && role === 'user') {
        return res.status(400).json({ message: "You cannot demote yourself" });
      }
      
      const updatedUser = await storage.updateUserRole(id, role);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Prevent admin from deleting themselves
      if (id === req.user.id) {
        return res.status(400).json({ message: "You cannot delete yourself" });
      }
      
      // Check if user exists in our database
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete user's grant applications first (this will cascade to related data via foreign keys)
      const userApplications = await storage.getUserGrantApplications(id);
      for (const app of userApplications) {
        await storage.deleteGrantApplication(app.id);
      }
      
      // Delete invitations created by this user (foreign key constraint)
      const allInvitations = await storage.getInvitations();
      for (const invitation of allInvitations) {
        if (invitation.createdBy === id) {
          await storage.deleteInvitation(invitation.id);
        }
      }
      
      // Delete user from our database BEFORE Supabase Auth (our table references auth.users)
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete user from database" });
      }
      
      // Finally, delete from Supabase Auth
      const { supabaseAdmin } = await import('./supabase');
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
      
      if (authError && !authError.message?.includes('not found')) {
        console.error("Error deleting user from Supabase Auth:", authError);
        // User is already deleted from our DB, so just log the error
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Accept invitation (public route - redirects to signup with token)
  app.get("/api/accept-invitation", async (req: any, res) => {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).send("Invalid invitation link");
      }

      const invitation = await storage.getInvitationByToken(token as string);
      
      if (!invitation) {
        return res.status(404).send("Invitation not found or has been used");
      }

      if (invitation.used) {
        return res.status(400).send("This invitation has already been used");
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).send("This invitation has expired");
      }

      // Redirect to frontend signup page with token
      res.redirect(`/auth?token=${token}`);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).send("Failed to process invitation");
    }
  });

  // Export applications to XLSX
  app.get("/api/admin/applications/export/xlsx", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, startDate, endDate } = req.query;
      
      // Parse date parameters
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? (() => {
        const date = new Date(endDate as string);
        // Set to end of day to include the full selected day
        date.setHours(23, 59, 59, 999);
        return date;
      })() : undefined;
      
      // Validate date parameters
      if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({ message: "Invalid startDate format" });
      }
      
      if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ message: "Invalid endDate format" });
      }
      
      // Fetch filtered applications
      const applications = await storage.getGrantApplicationsWithUserDataFiltered(
        status && status !== 'all' ? status as string : undefined,
        parsedStartDate,
        parsedEndDate
      );
      
      // Import ExcelJS library with error handling
      let ExcelJS;
      try {
        ExcelJS = require('exceljs');
      } catch (error) {
        console.error("ExcelJS library not found:", error);
        return res.status(500).json({ message: "Export functionality not available - missing dependencies" });
      }
      
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Applications');
      
      // Define columns
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'User ID', key: 'userId', width: 15 },
        { header: 'First Name', key: 'firstName', width: 15 },
        { header: 'Last Name', key: 'lastName', width: 15 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Progress (%)', key: 'progress', width: 12 },
        { header: 'Agricultural Return', key: 'agriculturalReturn', width: 18 },
        { header: 'Land Declaration', key: 'landDeclaration', width: 16 },
        { header: 'Consent Form', key: 'consentForm', width: 14 },
        { header: 'Supporting Docs', key: 'supportingDocs', width: 16 },
        { header: 'Created At', key: 'createdAt', width: 22 },
        { header: 'Submitted At', key: 'submittedAt', width: 22 }
      ];
      
      // Add rows
      applications.forEach(app => {
        worksheet.addRow({
          id: app.id,
          userId: sanitizeForExport(app.userId),
          firstName: sanitizeForExport(app.userFirstName || ''),
          lastName: sanitizeForExport(app.userLastName || ''),
          email: sanitizeForExport(app.userEmail || ''),
          status: app.status,
          year: app.year,
          progress: app.progressPercentage || 0,
          agriculturalReturn: app.agriculturalReturnCompleted ? 'Yes' : 'No',
          landDeclaration: app.landDeclarationCompleted ? 'Yes' : 'No',
          consentForm: app.consentFormCompleted ? 'Yes' : 'No',
          supportingDocs: app.supportingDocsCompleted ? 'Yes' : 'No',
          createdAt: app.createdAt ? new Date(app.createdAt).toISOString() : '',
          submittedAt: app.submittedAt ? new Date(app.submittedAt).toISOString() : ''
        });
      });
      
      // Generate Excel buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Set response headers
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `applications-${timestamp}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      
    } catch (error) {
      console.error("Error exporting applications to XLSX:", error);
      res.status(500).json({ message: "Failed to export applications" });
    }
  });

  // Grant Application routes
  app.get("/api/grant-applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const applications = await storage.getUserGrantApplications(userId);
      // No caching for list endpoint to ensure fresh data after mutations
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json(applications);
    } catch (error) {
      console.error("Error fetching grant applications:", error);
      res.status(500).json({ message: "Failed to fetch grant applications" });
    }
  });

  app.post("/api/grant-applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentYear = new Date().getFullYear();
      
      const applicationData = insertGrantApplicationSchema.parse({
        ...req.body,
        userId,
        year: currentYear, // Server-derived year for security
      });
      
      // Check if user already has an application for this year
      const existingApplication = await storage.getUserGrantApplicationForYear(userId, currentYear);
      if (existingApplication) {
        return res.status(409).json({ 
          message: "You already have a grant application for this year. Only one application per year is allowed.",
          existingApplicationId: existingApplication.id
        });
      }
      
      const application = await storage.createGrantApplication(applicationData);
      res.json(application);
    } catch (error) {
      console.error("Error creating grant application:", error);
      // Handle unique constraint violation
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return res.status(409).json({ 
          message: "You already have a grant application for this year. Only one application per year is allowed."
        });
      }
      res.status(500).json({ message: "Failed to create grant application" });
    }
  });

  app.get("/api/grant-applications/:publicId", isAuthenticated, async (req: any, res) => {
    try {
      const publicId = req.params.publicId;
      const application = await storage.getGrantApplicationByPublicId(publicId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check if user owns this application
      if (application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // No caching to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json(application);
    } catch (error) {
      console.error("Error fetching grant application:", error);
      res.status(500).json({ message: "Failed to fetch grant application" });
    }
  });

  app.patch("/api/grant-applications/:publicId", isAuthenticated, async (req: any, res) => {
    try {
      const publicId = req.params.publicId;
      const application = await storage.getGrantApplicationByPublicId(publicId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check if user owns this application
      if (application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updates = req.body;
      
      // Handle submission timestamp properly
      if (updates.status === "submitted") {
        updates.submittedAt = new Date();
      }
      
      const updatedApplication = await storage.updateGrantApplication(application.id, updates);
      res.json(updatedApplication);
    } catch (error) {
      console.error("Error updating grant application:", error);
      res.status(500).json({ message: "Failed to update grant application" });
    }
  });

  app.delete("/api/grant-applications/:publicId", isAuthenticated, async (req: any, res) => {
    try {
      const publicId = req.params.publicId;
      const application = await storage.getGrantApplicationByPublicId(publicId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check if user owns this application
      if (application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const deleted = await storage.deleteGrantApplication(application.id);
      if (deleted) {
        res.json({ message: "Application deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete application" });
      }
    } catch (error) {
      console.error("Error deleting grant application:", error);
      res.status(500).json({ message: "Failed to delete grant application" });
    }
  });

  // Agricultural Return routes
  app.post("/api/agricultural-returns", isAuthenticated, async (req: any, res) => {
    try {
      const createData = req.body;
      
      // Validate required field
      if (!createData.applicationId || typeof createData.applicationId !== 'number') {
        return res.status(400).json({ message: "Valid applicationId is required" });
      }
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(createData.applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const returnData = {
        applicationId: createData.applicationId,
        farmDetailsData: createData.farmDetailsData || null,
        accreditationData: createData.accreditationData || null,
        financialData: createData.financialData || null,
        facilitiesData: createData.facilitiesData || null,
        livestockData: createData.livestockData || null,
        managementPlans: createData.managementPlans || null,
        tier3Data: createData.tier3Data || null,
        declarationName: createData.declarationName || null,
        declarationDate: createData.declarationDate ? new Date(createData.declarationDate) : null,
        declarationSignature: createData.declarationSignature || null,
        isComplete: !!createData.isComplete,
        completedSections: createData.completedSections || null,
      };
      
      const agriculturalReturn = await storage.createAgriculturalReturn(returnData);
      
      // Update application progress if the return is marked complete
      if (createData.isComplete) {
        const progressPercentage = await calculateProgress({
          ...application,
          agriculturalReturnCompleted: true,
        });
        
        await storage.updateGrantApplication(createData.applicationId, {
          agriculturalReturnCompleted: true,
          progressPercentage,
        });
      }
      
      res.json(agriculturalReturn);
    } catch (error) {
      console.error("Error creating agricultural return:", error);
      res.status(500).json({ message: "Failed to create agricultural return" });
    }
  });

  app.get("/api/agricultural-returns/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const agriculturalReturn = await storage.getAgriculturalReturnByApplicationId(applicationId);
      // Add cache control for browser caching
      res.set('Cache-Control', 'private, max-age=30');
      res.json(agriculturalReturn);
    } catch (error) {
      console.error("Error fetching agricultural return:", error);
      res.status(500).json({ message: "Failed to fetch agricultural return" });
    }
  });

  app.put("/api/agricultural-returns/:id", isAuthenticated, async (req: any, res) => {
    try {
      const returnId = parseInt(req.params.id);
      const updateData = req.body;
      
      // Validate required field
      if (!updateData.applicationId || typeof updateData.applicationId !== 'number') {
        return res.status(400).json({ message: "Valid applicationId is required" });
      }
      
      // Get the existing agricultural return to verify ownership
      const existingReturn = await storage.getAgriculturalReturnByApplicationId(updateData.applicationId);
      if (!existingReturn || existingReturn.id !== returnId) {
        return res.status(404).json({ message: "Agricultural return not found" });
      }
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(updateData.applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedReturn = await storage.updateAgriculturalReturn(returnId, {
        farmDetailsData: updateData.farmDetailsData || null,
        accreditationData: updateData.accreditationData || null,
        financialData: updateData.financialData || null,
        facilitiesData: updateData.facilitiesData || null,
        livestockData: updateData.livestockData || null,
        managementPlans: updateData.managementPlans || null,
        tier3Data: updateData.tier3Data || null,
        declarationName: updateData.declarationName || null,
        declarationDate: updateData.declarationDate ? new Date(updateData.declarationDate) : null,
        declarationSignature: updateData.declarationSignature || null,
        isComplete: !!updateData.isComplete,
        completedSections: updateData.completedSections || null,
      });
      
      // Update application progress if the return is marked complete
      if (updateData.isComplete) {
        const progressPercentage = await calculateProgress({
          ...application,
          agriculturalReturnCompleted: true,
        });
        
        await storage.updateGrantApplication(updateData.applicationId, {
          agriculturalReturnCompleted: true,
          progressPercentage,
        });
      }
      
      res.json(updatedReturn);
    } catch (error) {
      console.error("Error updating agricultural return:", error);
      res.status(500).json({ message: "Failed to update agricultural return" });
    }
  });

  // Document routes
  app.post("/api/documents", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const applicationId = parseInt(req.body.applicationId);
      const documentType = req.body.documentType;
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Upload file to Supabase Storage
      const { path: storagePath, error: uploadError } = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        applicationId,
        documentType
      );
      
      if (uploadError || !storagePath) {
        console.error("Supabase upload error:", uploadError);
        return res.status(500).json({ message: "Failed to upload file to storage" });
      }
      
      const documentData = insertDocumentSchema.parse({
        applicationId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: storagePath,
        documentType,
      });
      
      const document = await storage.createDocument(documentData);
      
      // Update application progress based on document type
      if (documentType === "land_declaration") {
        await storage.updateGrantApplication(applicationId, {
          landDeclarationCompleted: true,
          progressPercentage: calculateProgressSync({
            ...application,
            landDeclarationCompleted: true,
          }),
        });
      } else if (documentType === "supporting_doc") {
        await storage.updateGrantApplication(applicationId, {
          supportingDocsCompleted: true,
          progressPercentage: calculateProgressSync({
            ...application,
            supportingDocsCompleted: true,
          }),
        });
      }
      
      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/documents/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const documents = await storage.getDocumentsByApplicationId(applicationId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Download document file route
  app.get("/api/download-document/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      
      if (!Number.isInteger(documentId) || documentId <= 0) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      // Get document directly by ID
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Verify user owns the application this document belongs to
      const application = await storage.getGrantApplication(document.applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      if (application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to document" });
      }
      
      // Check if file is stored in Supabase or locally
      if (isSupabasePath(document.filePath)) {
        // Download from Supabase Storage
        const { data: fileData, error: downloadError } = await downloadFile(document.filePath);
        
        if (downloadError || !fileData) {
          console.error(`Failed to download from Supabase: ${document.filePath}`, downloadError);
          return res.status(404).json({ message: "File not found in storage" });
        }
        
        res.setHeader('Content-Type', document.fileType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.setHeader('Content-Length', fileData.length);
        res.send(fileData);
      } else {
        // Legacy: Download from local filesystem
        if (!fs.existsSync(document.filePath)) {
          console.error(`Document file not found: ${document.filePath}`);
          return res.status(404).json({ message: "File not found on server" });
        }
        
        res.setHeader('Content-Type', document.fileType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.download(document.filePath, document.fileName, (error) => {
          if (error) {
            console.error("Error serving document download:", error);
            if (!res.headersSent) {
              res.status(500).json({ message: "Failed to download document" });
            }
          }
        });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Generate and download filled PDF for agricultural return
  app.get("/api/agricultural-returns/:returnId/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const returnId = parseInt(req.params.returnId);
      
      if (!Number.isInteger(returnId) || returnId <= 0) {
        return res.status(400).json({ message: "Invalid return ID" });
      }
      
      const agriculturalReturn = await storage.getAgriculturalReturn(returnId);
      if (!agriculturalReturn) {
        return res.status(404).json({ message: "Agricultural return not found" });
      }
      
      const application = await storage.getGrantApplication(agriculturalReturn.applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      if (application.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const pdfBuffer = await generateFilledPDF(agriculturalReturn, application.consentFarmCode);
      
      const farmName = (agriculturalReturn.farmDetailsData as any)?.farmName || 'Farm';
      const fileName = `RSS_Application_2026_${farmName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Download template route (public - templates are not sensitive)
  app.get("/api/download-template/:type", (req, res) => {
    try {
      const templateType = req.params.type;
      
      if (templateType === "land-declaration") {
        // Serve the Excel template for land declaration (2026 version)
        const templatePath = path.join("templates", "land-declaration-template-2026.xlsx");
        
        if (!fs.existsSync(templatePath)) {
          console.error("Land declaration template not found:", templatePath);
          return res.status(404).json({ message: "Template file not found" });
        }
        
        res.download(templatePath, "Land_Declaration_2025_for_2026.xlsx", (error) => {
          if (error) {
            console.error("Error serving template download:", error);
            if (!res.headersSent) {
              res.status(500).json({ message: "Failed to download template" });
            }
          }
        });
      } else if (templateType === "rss-guidance") {
        // Serve the Rural Support Scheme Guidance PDF
        const templatePath = path.join("templates", "rural-support-scheme-guidance.pdf");
        
        if (!fs.existsSync(templatePath)) {
          console.error("RSS guidance document not found:", templatePath);
          return res.status(404).json({ message: "Guidance document not found" });
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Rural_Support_Scheme_Guidance_2026.pdf"');
        res.sendFile(path.resolve(templatePath), (error) => {
          if (error) {
            console.error("Error serving guidance document:", error);
            if (!res.headersSent) {
              res.status(500).json({ message: "Failed to serve guidance document" });
            }
          }
        });
      } else if (templateType === "rss-application") {
        // Serve the PDF template for RSS application
        const templatePath = path.join("templates", "rss-application-template.pdf");
        
        if (!fs.existsSync(templatePath)) {
          console.error("RSS application template not found:", templatePath);
          return res.status(404).json({ message: "Template file not found" });
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="RSS_Application_Template.pdf"');
        res.sendFile(path.resolve(templatePath), (error) => {
          if (error) {
            console.error("Error serving template:", error);
            if (!res.headersSent) {
              res.status(500).json({ message: "Failed to serve template" });
            }
          }
        });
      } else {
        res.status(404).json({ message: "Template not found" });
      }
    } catch (error) {
      console.error("Error downloading template:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download template" });
      }
    }
  });

  // Fill consent form PDF route
  app.post("/api/fill-consent-pdf", isAuthenticated, async (req: any, res) => {
    try {
      const { name, address, farmCode, email, signature } = req.body;
      
      if (!name || !address || !farmCode || !email) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Read the PDF template
      const templatePath = path.join("templates", "rss-application-template.pdf");
      
      if (!fs.existsSync(templatePath)) {
        console.error("RSS Application template not found:", templatePath);
        return res.status(404).json({ message: "Template file not found" });
      }
      
      const existingPdfBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      
      if (pages.length === 0) {
        return res.status(400).json({ message: "Invalid PDF template" });
      }
      
      const firstPage = pages[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 10;
      const maxLineWidth = 250; // Maximum width for text before wrapping
      
      // Helper function to wrap text
      const wrapText = (text: string, maxWidth: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const textWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (textWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        });
        
        if (currentLine) lines.push(currentLine);
        return lines;
      };
      
      // Page 1: Add name on the right side
      const nameText = name.length > 40 ? name.substring(0, 40) + '...' : name;
      firstPage.drawText(nameText, {
        x: 350,
        y: firstPage.getHeight() - 150,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      // Page 1: Add farm code on the right side below name
      firstPage.drawText(farmCode, {
        x: 350,
        y: firstPage.getHeight() - 165,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      // Page 1: Add address on the left side (split into multiple lines with wrapping)
      const addressLines = address.split('\n').flatMap((line: string) => wrapText(line, maxLineWidth));
      const maxAddressLines = 4; // Limit to prevent overflow
      let yOffset = firstPage.getHeight() - 165;
      addressLines.slice(0, maxAddressLines).forEach((line: string, index: number) => {
        firstPage.drawText(line, {
          x: 50,
          y: yOffset - (index * 12),
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
      });
      
      // Page 3: Add name after "Declaration Notes re Rural Support Scheme" heading
      if (pages.length >= 3) {
        const thirdPage = pages[2]; // Page 3 (0-indexed)
        thirdPage.drawText(nameText, {
          x: 50,
          y: thirdPage.getHeight() - 275,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
      }
      
      // Page 5: Add signature, name, and date (centered, 3/4 down the page)
      if (pages.length >= 5) {
        const fifthPage = pages[4]; // Page 5 (0-indexed)
        const centerX = 298; // Middle of page (A4 width is 595pt)
        
        // Add signature at top (centered, with label to the left)
        if (signature) {
          try {
            // Parse the base64 signature image
            const signatureData = signature.replace(/^data:image\/png;base64,/, '');
            const signatureBytes = Buffer.from(signatureData, 'base64');
            const signatureImage = await pdfDoc.embedPng(signatureBytes);
            
            // Scale to 0.2 and position centered
            const signatureDims = signatureImage.scale(0.2);
            fifthPage.drawImage(signatureImage, {
              x: centerX,
              y: fifthPage.getHeight() - 632,
              width: signatureDims.width,
              height: signatureDims.height,
            });
          } catch (signatureError) {
            secureLog('error', 'Error embedding signature:', signatureError);
            // Continue without signature rather than failing completely
          }
        }
        
        // Add name below signature (centered, with label to the left)
        fifthPage.drawText(nameText, {
          x: centerX,
          y: fifthPage.getHeight() - 662,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
        
        // Add today's date below name (centered, with label to the left)
        const today = new Date();
        const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        fifthPage.drawText(formattedDate, {
          x: centerX,
          y: fifthPage.getHeight() - 692,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
      }
      
      // Serialize the PDFDocument to bytes
      const pdfBytes = await pdfDoc.save();
      
      // Send the PDF as a response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="RSS_Application_Filled.pdf"');
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("Error filling consent PDF:", error);
      res.status(500).json({ message: "Failed to fill consent PDF" });
    }
  });

  // Digital signature route
  app.post("/api/digital-signature/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      const { signature, name, address, farmCode, email } = req.body;
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedApplication = await storage.updateGrantApplication(applicationId, {
        digitalSignature: signature,
        consentName: name,
        consentAddress: address,
        consentFarmCode: farmCode,
        consentEmail: email,
        consentFormCompleted: true,
        progressPercentage: calculateProgressSync({
          ...application,
          consentFormCompleted: true,
        }),
      });
      
      res.json(updatedApplication);
    } catch (error) {
      secureLog('error', 'Error saving digital signature:', error);
      res.status(500).json({ message: "Failed to save digital signature" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions
async function calculateProgress(application: any): Promise<number> {
  // If application is submitted/approved/rejected, return 100%
  if (application.status === 'submitted' || application.status === 'approved' || application.status === 'rejected') {
    return 100;
  }
  
  let completed = 0;
  const total = 3; // Total sections: Agricultural Return, Land Declaration, Supporting Docs
  // Note: Digital signature/consent is now part of Agricultural Return
  
  // Check if agricultural return is completed via form response
  // Get the active template first
  const activeTemplates = await storage.getActiveAgriculturalFormTemplates();
  if (activeTemplates.length > 0) {
    const mostRecentTemplate = activeTemplates.sort((a, b) => b.year - a.year)[0];
    const agriculturalResponse = await storage.getAgriculturalFormResponse(mostRecentTemplate.id, application.id);
    if (agriculturalResponse && agriculturalResponse.isComplete) completed++;
  } else {
    // Fallback to old system if no templates available
    if (application.agriculturalReturnCompleted) completed++;
  }
  
  if (application.landDeclarationCompleted) completed++;
  if (application.supportingDocsCompleted) completed++;
  
  return Math.round((completed / total) * 100);
}

function calculateProgressSync(application: any): number {
  // If application is submitted/approved/rejected, return 100%
  if (application.status === 'submitted' || application.status === 'approved' || application.status === 'rejected') {
    return 100;
  }
  
  let completed = 0;
  const total = 3; // Total sections: Agricultural Return, Land Declaration, Supporting Docs
  // Note: Digital signature/consent is now part of Agricultural Return
  
  if (application.agriculturalReturnCompleted) completed++;
  if (application.landDeclarationCompleted) completed++;
  if (application.supportingDocsCompleted) completed++;
  
  return Math.round((completed / total) * 100);
}
