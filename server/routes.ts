import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGrantApplicationSchema, insertAgriculturalReturnSchema, insertDocumentSchema, insertAgriculturalFormTemplateSchema, insertAgriculturalFormResponseSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Admin routes
  app.get("/api/admin/applications", isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.query;
      let applications;
      
      if (status && status !== 'all') {
        applications = await storage.getGrantApplicationsByStatus(status as string);
      } else {
        applications = await storage.getAllGrantApplications();
      }
      
      res.json(applications);
    } catch (error) {
      console.error("Error fetching admin applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.patch("/api/admin/applications/:id/status", isAuthenticated, async (req: any, res) => {
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

  // Agricultural Form Template routes
  app.get("/api/admin/agricultural-forms", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/admin/agricultural-forms", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/admin/agricultural-forms/:id", isAuthenticated, async (req: any, res) => {
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

  app.put("/api/admin/agricultural-forms/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/admin/agricultural-forms/:id", isAuthenticated, async (req: any, res) => {
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
      if (!application || application.userId !== req.user.claims.sub) {
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
      if (!application || application.userId !== req.user.claims.sub) {
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
      if (!application || application.userId !== req.user.claims.sub) {
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
      const userId = req.user.claims.sub;
      const applications = await storage.getUserGrantApplications(userId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching grant applications:", error);
      res.status(500).json({ message: "Failed to fetch grant applications" });
    }
  });

  app.post("/api/grant-applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const applicationData = insertGrantApplicationSchema.parse({
        ...req.body,
        userId,
      });
      
      const application = await storage.createGrantApplication(applicationData);
      res.json(application);
    } catch (error) {
      console.error("Error creating grant application:", error);
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
      if (application.userId !== req.user.claims.sub) {
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
      if (application.userId !== req.user.claims.sub) {
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

  // Agricultural Return routes
  app.post("/api/agricultural-returns", isAuthenticated, async (req: any, res) => {
    try {
      const returnData = insertAgriculturalReturnSchema.parse(req.body);
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(returnData.applicationId);
      if (!application || application.userId !== req.user.claims.sub) {
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
      if (!application || application.userId !== req.user.claims.sub) {
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
      if (!application || application.userId !== req.user.claims.sub) {
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
      if (!application || application.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const documents = await storage.getDocumentsByApplicationId(applicationId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Download template route
  app.get("/api/download-template/:type", isAuthenticated, (req, res) => {
    try {
      const templateType = req.params.type;
      
      if (templateType === "land-declaration") {
        // Generate Excel template for land declaration
        const templatePath = generateLandDeclarationTemplate();
        res.download(templatePath, "land-declaration-template.xlsx");
      } else {
        res.status(404).json({ message: "Template not found" });
      }
    } catch (error) {
      console.error("Error downloading template:", error);
      res.status(500).json({ message: "Failed to download template" });
    }
  });

  // Digital signature route
  app.post("/api/digital-signature/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      const { signature } = req.body;
      
      // Verify user owns the application
      const application = await storage.getGrantApplication(applicationId);
      if (!application || application.userId !== req.user.claims.sub) {
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
  // Simple CSV template generation
  const templateContent = `Field Name,Land Type,Acreage,Crop Type,Irrigation Type
Example Field 1,Arable,10.5,Wheat,Sprinkler
Example Field 2,Pasture,5.2,Grass,None
`;
  
  const templatePath = path.join("uploads", "land-declaration-template.csv");
  fs.writeFileSync(templatePath, templateContent);
  return templatePath;
}
