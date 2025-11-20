import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated, isAdmin, validateInvitationToken, markInvitationUsed } from "./supabaseAuth";
import { insertGrantApplicationSchema, insertAgriculturalReturnSchema, insertDocumentSchema, insertAgriculturalFormTemplateSchema, insertAgriculturalFormResponseSchema, insertInvitationSchema } from "@shared/schema";
import { sendInvitationEmail } from "./resend";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";

// Helper function to prevent CSV/XLSX formula injection
const sanitizeForExport = (value: any): string => {
  const str = String(value);
  // If string starts with formula characters (with optional leading whitespace), prefix with single quote
  if (str.match(/^[\t\r\n\s]*[=+\-@]/)) {
    return `'${str}`;
  }
  return str;
};

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
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

// Configure multer for profile picture uploads (images only)
const uploadProfilePicture = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('image/');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed for profile pictures"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
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
      console.error('Error validating invitation:', error);
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
      console.error('Error using invitation:', error);
      res.status(500).json({ message: 'Failed to mark invitation as used' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile routes
  app.patch('/api/user/profile', isAuthenticated, uploadProfilePicture.single('profileImage'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName } = req.body;
      
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      
      // Handle profile image upload
      if (req.file) {
        // Get current user to find old profile image
        const currentUser = await storage.getUser(userId);
        
        // Delete old profile image if it exists
        if (currentUser?.profileImageUrl) {
          const oldImagePath = currentUser.profileImageUrl.startsWith('/') 
            ? currentUser.profileImageUrl.substring(1) 
            : currentUser.profileImageUrl;
          
          if (fs.existsSync(oldImagePath)) {
            try {
              fs.unlinkSync(oldImagePath);
            } catch (err) {
              console.error("Failed to delete old profile image:", err);
            }
          }
        }
        
        const fileExtension = path.extname(req.file.originalname);
        const newFilename = `profile-${userId}${fileExtension}`;
        const newPath = path.join('uploads', newFilename);
        
        // Rename the uploaded file
        fs.renameSync(req.file.path, newPath);
        updates.profileImageUrl = `/${newPath}`;
      }
      
      // Update user profile
      const updatedUser = await storage.upsertUser({
        id: userId,
        ...updates,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.delete('/api/user/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { supabaseAdmin } = await import('./supabase');
      
      // Get current user to delete profile image
      const currentUser = await storage.getUser(userId);
      
      // Delete all user's grant applications and related data
      const applications = await storage.getUserGrantApplications(userId);
      
      for (const application of applications) {
        // Delete all documents for this application
        const documents = await storage.getDocumentsByApplicationId(application.id);
        for (const doc of documents) {
          // Delete physical file
          if (doc.filePath && fs.existsSync(doc.filePath)) {
            try {
              fs.unlinkSync(doc.filePath);
            } catch (err) {
              console.error("Failed to delete document file:", err);
            }
          }
          await storage.deleteDocument(doc.id);
        }
        
        // Delete application
        await storage.deleteGrantApplication(application.id);
      }
      
      // Delete user's profile image
      if (currentUser?.profileImageUrl) {
        const profileImagePath = currentUser.profileImageUrl.startsWith('/') 
          ? currentUser.profileImageUrl.substring(1) 
          : currentUser.profileImageUrl;
        
        if (fs.existsSync(profileImagePath)) {
          try {
            fs.unlinkSync(profileImagePath);
          } catch (err) {
            console.error("Failed to delete profile image:", err);
          }
        }
      }
      
      // Delete user from Supabase Auth (this will cascade to public.users via ON DELETE CASCADE)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (error) {
        console.error("Error deleting user from Supabase:", error);
        return res.status(500).json({ message: "Failed to delete account" });
      }
      
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Admin routes
  app.get("/api/admin/applications", isAuthenticated, isAdmin, async (req: any, res) => {
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
      
      // Use the new filtered method that handles all scenarios
      const applications = await storage.getGrantApplicationsWithUserDataFiltered(
        status && status !== 'all' ? status as string : undefined,
        parsedStartDate,
        parsedEndDate
      );
      
      res.json(applications);
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
      
      // Get application IDs for bulk fetching
      const applicationIds = applications.map(app => app.id);
      
      // Fetch agricultural form responses and documents in bulk
      const [formResponses, documents] = await Promise.all([
        storage.getAgriculturalFormResponsesForApplications(applicationIds),
        storage.getDocumentsForApplications(applicationIds)
      ]);
      
      // Create lookup maps for efficient access
      const responseMap = new Map();
      formResponses.forEach(response => {
        responseMap.set(response.applicationId, response);
      });
      
      const documentsMap = new Map();
      documents.forEach(doc => {
        if (!documentsMap.has(doc.applicationId)) {
          documentsMap.set(doc.applicationId, []);
        }
        documentsMap.get(doc.applicationId).push(doc);
      });
      
      // Helper function to generate document URLs
      const getDocumentUrl = (doc: any) => {
        const baseUrl = req.protocol + '://' + req.get('host');
        return `${baseUrl}/api/documents/download/${doc.id}`;
      };
      
      // Extract all unique form fields from responses to create dynamic headers
      const allFormFields = new Set();
      formResponses.forEach(response => {
        if (response.responses && typeof response.responses === 'object') {
          Object.keys(response.responses).forEach(fieldId => {
            allFormFields.add(fieldId);
          });
        }
      });
      
      // Generate CSV headers with dynamic form fields
      const baseHeaders = [
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
        'Submitted At'
      ];
      
      // Add agricultural form fields as separate columns
      const formFieldHeaders: string[] = Array.from(allFormFields).map(field => String(field)).sort();
      const documentHeaders = [
        'Land Declaration Documents',
        'Supporting Documents',
        'All Document URLs'
      ];
      
      const headers = [...baseHeaders, ...formFieldHeaders.map(field => `Form Field: ${field}`), ...documentHeaders];
      
      // Convert applications to CSV format
      const csvData = applications.map(app => {
        const response = responseMap.get(app.id);
        const appDocuments = documentsMap.get(app.id) || [];
        
        // Extract form field values
        const formFieldValues = formFieldHeaders.map((fieldId: string) => {
          if (response && response.responses && typeof response.responses === 'object') {
            const responses = response.responses as Record<string, any>;
            const value = responses[fieldId];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') {
              return sanitizeForExport(JSON.stringify(value));
            }
            return sanitizeForExport(String(value));
          }
          return '';
        });
        
        // Separate documents by type
        const landDeclarationDocs = appDocuments
          .filter((doc: any) => doc.documentType === 'land_declaration')
          .map((doc: any) => `${doc.fileName} (${getDocumentUrl(doc)})`)
          .join('; ');
          
        const supportingDocs = appDocuments
          .filter((doc: any) => doc.documentType === 'supporting_doc')
          .map((doc: any) => `${doc.fileName} (${getDocumentUrl(doc)})`)
          .join('; ');
          
        const allDocuments = appDocuments
          .map((doc: any) => `${doc.fileName} (${getDocumentUrl(doc)})`)
          .join('; ');
        
        return [
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
          ...formFieldValues,
          sanitizeForExport(landDeclarationDocs),
          sanitizeForExport(supportingDocs),
          sanitizeForExport(allDocuments)
        ];
      });
      
      // Create CSV content
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      // Set response headers
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
      
      // Check if file exists
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }
      
      // Set proper content type and force download
      res.setHeader('Content-Type', document.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.download(document.filePath, document.fileName);
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
      
      // Check if file exists
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }
      
      // Set proper content type and serve inline
      res.setHeader('Content-Type', document.fileType);
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
      res.sendFile(path.resolve(document.filePath));
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

  // Accept invitation (public route - redirects to login with token)
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

      // Store token in session for validation after login
      req.session.invitationToken = token;
      
      // Redirect to login
      res.redirect('/api/login');
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
      
      // Import XLSX library with error handling
      let XLSX;
      try {
        XLSX = require('xlsx');
      } catch (error) {
        console.error("XLSX library not found:", error);
        return res.status(500).json({ message: "Export functionality not available - missing dependencies" });
      }
      
      // Prepare data for Excel
      const worksheetData = applications.map(app => ({
        'ID': app.id,
        'User ID': sanitizeForExport(app.userId),
        'First Name': sanitizeForExport(app.userFirstName || ''),
        'Last Name': sanitizeForExport(app.userLastName || ''),
        'Email': sanitizeForExport(app.userEmail || ''),
        'Status': app.status,
        'Year': app.year,
        'Progress (%)': app.progressPercentage || 0,
        'Agricultural Return': app.agriculturalReturnCompleted ? 'Yes' : 'No',
        'Land Declaration': app.landDeclarationCompleted ? 'Yes' : 'No',
        'Consent Form': app.consentFormCompleted ? 'Yes' : 'No',
        'Supporting Docs': app.supportingDocsCompleted ? 'Yes' : 'No',
        'Created At': app.createdAt ? new Date(app.createdAt).toISOString() : '',
        'Submitted At': app.submittedAt ? new Date(app.submittedAt).toISOString() : ''
      }));
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications');
      
      // Generate Excel buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
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

  // Public endpoint for users to access active agricultural form templates
  app.get("/api/agricultural-forms/templates", isAuthenticated, async (req: any, res) => {
    try {
      let templates = await storage.getAgriculturalFormTemplates();
      
      // Create default template if none exist
      if (templates.length === 0) {
        const defaultTemplate = {
          title: "Agricultural Return 2025",
          description: "Annual agricultural return form for crop and livestock reporting",
          year: 2025,
          isActive: true,
          sections: [
            {
              id: "landowner-details",
              title: "Landowner Details",
              description: "Basic information about the landowner",
              order: 1,
              fields: [
                {
                  id: "full-name",
                  type: "text",
                  label: "Full Name",
                  placeholder: "Enter your full name",
                  required: true
                },
                {
                  id: "address",
                  type: "textarea",
                  label: "Address",
                  placeholder: "Enter your full address",
                  required: true
                },
                {
                  id: "phone",
                  type: "text",
                  label: "Phone Number",
                  placeholder: "Enter your phone number",
                  required: true
                }
              ]
            },
            {
              id: "land-crops",
              title: "Land & Crops",
              description: "Information about your land usage and crops",
              order: 2,
              fields: [
                {
                  id: "total-area",
                  type: "number",
                  label: "Total Land Area (hectares)",
                  placeholder: "Enter total area in hectares",
                  required: true
                },
                {
                  id: "crop-types",
                  type: "textarea",
                  label: "Crop Types",
                  placeholder: "List the main crops you grow",
                  required: true
                },
                {
                  id: "farming-method",
                  type: "select",
                  label: "Farming Method",
                  placeholder: "Select your primary farming method",
                  required: true,
                  options: ["Organic", "Conventional", "Mixed"]
                }
              ]
            },
            {
              id: "livestock",
              title: "Livestock",
              description: "Information about livestock on your farm",
              order: 3,
              fields: [
                {
                  id: "cattle-count",
                  type: "number",
                  label: "Number of Cattle",
                  placeholder: "Enter number of cattle",
                  required: false
                },
                {
                  id: "sheep-count",
                  type: "number",
                  label: "Number of Sheep",
                  placeholder: "Enter number of sheep",
                  required: false
                },
                {
                  id: "other-livestock",
                  type: "textarea",
                  label: "Other Livestock",
                  placeholder: "Describe any other livestock",
                  required: false
                }
              ]
            }
          ]
        };
        
        const newTemplate = await storage.createAgriculturalFormTemplate(defaultTemplate);
        templates = [newTemplate];
      }
      
      // Only return active templates for public endpoint
      const activeTemplates = templates.filter(template => template.isActive);
      res.json(activeTemplates);
    } catch (error) {
      console.error("Error fetching agricultural form templates:", error);
      res.status(500).json({ message: "Failed to fetch agricultural form templates" });
    }
  });

  // Admin endpoint to get agricultural form responses for an application
  app.get("/api/admin/applications/:id/agricultural-response", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const applicationId = parseInt(id);
      
      // Get the latest agricultural form response for this application
      const response = await storage.getAgriculturalFormResponseByApplication(applicationId);
      
      if (!response) {
        return res.status(404).json({ message: "No agricultural form response found" });
      }
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching agricultural form response for admin:", error);
      res.status(500).json({ message: "Failed to fetch agricultural form response" });
    }
  });

  // Agricultural Form Template routes (Admin only)
  app.get("/api/admin/agricultural-forms", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      let templates = await storage.getAgriculturalFormTemplates();
      
      // Create default template if none exist
      if (templates.length === 0) {
        const defaultTemplate = {
          title: "Agricultural Return 2025",
          description: "Annual agricultural return form for crop and livestock reporting",
          year: 2025,
          isActive: true,
          sections: [
            {
              id: "landowner-details",
              title: "Landowner Details",
              description: "Basic information about the landowner",
              order: 1,
              fields: [
                {
                  id: "full-name",
                  type: "text",
                  label: "Full Name",
                  placeholder: "Enter your full name",
                  required: true
                },
                {
                  id: "address",
                  type: "textarea",
                  label: "Address",
                  placeholder: "Enter your full address",
                  required: true
                },
                {
                  id: "phone",
                  type: "text",
                  label: "Phone Number",
                  placeholder: "Enter your phone number",
                  required: true
                }
              ]
            },
            {
              id: "land-crops",
              title: "Land & Crops",
              description: "Information about your land usage and crops",
              order: 2,
              fields: [
                {
                  id: "total-acreage",
                  type: "number",
                  label: "Total Acreage",
                  placeholder: "Enter total acreage",
                  required: true
                },
                {
                  id: "crop-type",
                  type: "select",
                  label: "Primary Crop Type",
                  required: true,
                  options: ["Wheat", "Corn", "Soybeans", "Rice", "Barley", "Other"]
                },
                {
                  id: "organic-farming",
                  type: "checkbox",
                  label: "I practice organic farming",
                  required: false
                }
              ]
            }
          ]
        };
        
        const createdTemplate = await storage.createAgriculturalFormTemplate(defaultTemplate);
        templates = [createdTemplate];
      }
      
      res.json(templates);
    } catch (error) {
      console.error("Error fetching agricultural form templates:", error);
      res.status(500).json({ message: "Failed to fetch agricultural form templates" });
    }
  });

  app.post("/api/admin/agricultural-forms", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      console.log("Received form data:", JSON.stringify(req.body, null, 2));
      const templateData = insertAgriculturalFormTemplateSchema.parse(req.body);
      console.log("Parsed template data:", JSON.stringify(templateData, null, 2));
      const newTemplate = await storage.createAgriculturalFormTemplate(templateData);
      res.json(newTemplate);
    } catch (error) {
      console.error("Error creating agricultural form template:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res.status(500).json({ 
        message: "Failed to create agricultural form template",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/admin/agricultural-forms/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const template = await storage.getAgriculturalFormTemplate(parseInt(id));
      if (!template) {
        return res.status(404).json({ message: "Agricultural form template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching agricultural form template:", error);
      res.status(500).json({ message: "Failed to fetch agricultural form template" });
    }
  });

  app.put("/api/admin/agricultural-forms/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = insertAgriculturalFormTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateAgriculturalFormTemplate(parseInt(id), updates);
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Agricultural form template not found" });
      }
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating agricultural form template:", error);
      res.status(500).json({ message: "Failed to update agricultural form template" });
    }
  });

  app.delete("/api/admin/agricultural-forms/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAgriculturalFormTemplate(parseInt(id));
      res.json({ message: "Agricultural form template deleted successfully" });
    } catch (error) {
      console.error("Error deleting agricultural form template:", error);
      res.status(500).json({ message: "Failed to delete agricultural form template" });
    }
  });

  // Agricultural Form Response routes
  app.get("/api/agricultural-forms/:templateId/response/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const { templateId, applicationId } = req.params;
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(parseInt(applicationId));
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const response = await storage.getAgriculturalFormResponse(parseInt(templateId), parseInt(applicationId));
      if (!response) {
        return res.status(404).json({ message: "Agricultural form response not found" });
      }
      res.json(response);
    } catch (error) {
      console.error("Error fetching agricultural form response:", error);
      res.status(500).json({ message: "Failed to fetch agricultural form response" });
    }
  });

  app.post("/api/agricultural-forms/response", isAuthenticated, async (req: any, res) => {
    try {
      const responseData = insertAgriculturalFormResponseSchema.parse(req.body);
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(responseData.applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const newResponse = await storage.createAgriculturalFormResponse(responseData);
      
      // Update application progress
      const progressPercentage = await calculateProgress({
        ...application,
        agriculturalReturnCompleted: true,
      });
      
      await storage.updateGrantApplication(responseData.applicationId, {
        agriculturalReturnCompleted: true,
        progressPercentage,
      });
      
      res.json(newResponse);
    } catch (error) {
      console.error("Error creating agricultural form response:", error);
      res.status(500).json({ message: "Failed to create agricultural form response" });
    }
  });

  app.put("/api/agricultural-forms/response/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = insertAgriculturalFormResponseSchema.partial().parse(req.body);
      
      // Get existing response to verify ownership
      const existingResponse = await storage.getAgriculturalFormResponseById(parseInt(id));
      if (!existingResponse) {
        return res.status(404).json({ message: "Agricultural form response not found" });
      }
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(existingResponse.applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedResponse = await storage.updateAgriculturalFormResponse(parseInt(id), updates);
      if (!updatedResponse) {
        return res.status(404).json({ message: "Agricultural form response not found" });
      }
      
      // Update application progress
      const progressPercentage = await calculateProgress({
        ...application,
        agriculturalReturnCompleted: true,
      });
      
      await storage.updateGrantApplication(existingResponse.applicationId, {
        agriculturalReturnCompleted: true,
        progressPercentage,
      });
      
      res.json(updatedResponse);
    } catch (error) {
      console.error("Error updating agricultural form response:", error);
      res.status(500).json({ message: "Failed to update agricultural form response" });
    }
  });

  // Grant Application routes
  app.get("/api/grant-applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const applications = await storage.getUserGrantApplications(userId);
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

  app.get("/api/grant-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const application = await storage.getGrantApplication(applicationId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check if user owns this application
      if (application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.json(application);
    } catch (error) {
      console.error("Error fetching grant application:", error);
      res.status(500).json({ message: "Failed to fetch grant application" });
    }
  });

  app.patch("/api/grant-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const application = await storage.getGrantApplication(applicationId);
      
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
      
      const updatedApplication = await storage.updateGrantApplication(applicationId, updates);
      res.json(updatedApplication);
    } catch (error) {
      console.error("Error updating grant application:", error);
      res.status(500).json({ message: "Failed to update grant application" });
    }
  });

  app.delete("/api/grant-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const application = await storage.getGrantApplication(applicationId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check if user owns this application
      if (application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const deleted = await storage.deleteGrantApplication(applicationId);
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
      const returnData = insertAgriculturalReturnSchema.parse(req.body);
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(returnData.applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const agriculturalReturn = await storage.createAgriculturalReturn(returnData);
      
      // Update application progress
      const progressPercentage = await calculateProgress({
        ...application,
        agriculturalReturnCompleted: true,
      });
      
      await storage.updateGrantApplication(returnData.applicationId, {
        agriculturalReturnCompleted: true,
        progressPercentage,
      });
      
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
      res.json(agriculturalReturn);
    } catch (error) {
      console.error("Error fetching agricultural return:", error);
      res.status(500).json({ message: "Failed to fetch agricultural return" });
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
      
      const documentData = insertDocumentSchema.parse({
        applicationId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
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
      
      // Check if file exists on the filesystem
      if (!fs.existsSync(document.filePath)) {
        console.error(`Document file not found: ${document.filePath}`);
        return res.status(404).json({ message: "File not found on server" });
      }
      
      // Set proper content type and force download
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
    } catch (error) {
      console.error("Error downloading document:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Download template route
  app.get("/api/download-template/:type", isAuthenticated, (req, res) => {
    try {
      const templateType = req.params.type;
      
      if (templateType === "land-declaration") {
        // Generate CSV template for land declaration
        const templatePath = generateLandDeclarationTemplate();
        res.download(templatePath, "land-declaration-template.csv", (error) => {
          if (error) {
            console.error("Error serving template download:", error);
            if (!res.headersSent) {
              res.status(500).json({ message: "Failed to download template" });
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

  // Digital signature route
  app.post("/api/digital-signature/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      const { signature } = req.body;
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(applicationId);
      if (!application || application.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedApplication = await storage.updateGrantApplication(applicationId, {
        digitalSignature: signature,
        consentFormCompleted: true,
        progressPercentage: calculateProgressSync({
          ...application,
          consentFormCompleted: true,
        }),
      });
      
      res.json(updatedApplication);
    } catch (error) {
      console.error("Error saving digital signature:", error);
      res.status(500).json({ message: "Failed to save digital signature" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions
async function calculateProgress(application: any): Promise<number> {
  let completed = 0;
  const total = 4; // Total sections
  
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
  if (application.consentFormCompleted) completed++;
  if (application.supportingDocsCompleted) completed++;
  
  return Math.round((completed / total) * 100);
}

function calculateProgressSync(application: any): number {
  let completed = 0;
  const total = 4; // Total sections
  
  if (application.agriculturalReturnCompleted) completed++;
  if (application.landDeclarationCompleted) completed++;
  if (application.consentFormCompleted) completed++;
  if (application.supportingDocsCompleted) completed++;
  
  return Math.round((completed / total) * 100);
}

function generateLandDeclarationTemplate(): string {
  try {
    // Simple CSV template generation
    const templateContent = `Field Name,Land Type,Acreage,Crop Type,Irrigation Type
Example Field 1,Arable,10.5,Wheat,Sprinkler
Example Field 2,Pasture,5.2,Grass,None
`;
    
    const templatePath = path.join("uploads", "land-declaration-template.csv");
    
    // Ensure uploads directory exists
    const uploadsDir = path.dirname(templatePath);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    fs.writeFileSync(templatePath, templateContent);
    return templatePath;
  } catch (error) {
    console.error("Error generating land declaration template:", error);
    throw new Error("Failed to generate template file");
  }
}
