import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGrantApplicationSchema, insertAgriculturalReturnSchema, insertDocumentSchema } from "@shared/schema";
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
      await storage.updateGrantApplication(returnData.applicationId, {
        agriculturalReturnCompleted: true,
        progressPercentage: calculateProgress({
          ...application,
          agriculturalReturnCompleted: true,
        }),
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
          progressPercentage: calculateProgress({
            ...application,
            landDeclarationCompleted: true,
          }),
        });
      } else if (documentType === "supporting_doc") {
        await storage.updateGrantApplication(applicationId, {
          supportingDocsCompleted: true,
          progressPercentage: calculateProgress({
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
        progressPercentage: calculateProgress({
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
function calculateProgress(application: any): number {
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
