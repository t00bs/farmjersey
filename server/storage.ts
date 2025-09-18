import {
  users,
  grantApplications,
  agriculturalReturns,
  documents,
  agriculturalFormTemplates,
  agriculturalFormResponses,
  type User,
  type UpsertUser,
  type GrantApplication,
  type InsertGrantApplication,
  type AgriculturalReturn,
  type InsertAgriculturalReturn,
  type Document,
  type InsertDocument,
  type AgriculturalFormTemplate,
  type InsertAgriculturalFormTemplate,
  type AgriculturalFormResponse,
  type InsertAgriculturalFormResponse,
  type ApplicationWithUserData,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Grant Application operations
  createGrantApplication(application: InsertGrantApplication): Promise<GrantApplication>;
  getGrantApplication(id: number): Promise<GrantApplication | undefined>;
  getUserGrantApplications(userId: string): Promise<GrantApplication[]>;
  getUserGrantApplicationForYear(userId: string, year: number): Promise<GrantApplication | undefined>;
  getAllGrantApplications(): Promise<GrantApplication[]>;
  getGrantApplicationsByStatus(status: string): Promise<GrantApplication[]>;
  getAllGrantApplicationsWithUserData(): Promise<ApplicationWithUserData[]>;
  getGrantApplicationsByStatusWithUserData(status: string): Promise<ApplicationWithUserData[]>;
  getGrantApplicationsWithUserDataFiltered(status?: string, startDate?: Date, endDate?: Date): Promise<ApplicationWithUserData[]>;
  updateGrantApplication(id: number, updates: Partial<InsertGrantApplication>): Promise<GrantApplication | undefined>;
  deleteGrantApplication(id: number): Promise<boolean>;
  
  // Agricultural Return operations
  createAgriculturalReturn(agriculturalReturn: InsertAgriculturalReturn): Promise<AgriculturalReturn>;
  getAgriculturalReturnByApplicationId(applicationId: number): Promise<AgriculturalReturn | undefined>;
  updateAgriculturalReturn(id: number, updates: Partial<InsertAgriculturalReturn>): Promise<AgriculturalReturn | undefined>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByApplicationId(applicationId: number): Promise<Document[]>;
  deleteDocument(id: number): Promise<void>;
  
  // Agricultural Form Template operations
  createAgriculturalFormTemplate(template: InsertAgriculturalFormTemplate): Promise<AgriculturalFormTemplate>;
  getAgriculturalFormTemplates(): Promise<AgriculturalFormTemplate[]>;
  getActiveAgriculturalFormTemplates(): Promise<AgriculturalFormTemplate[]>;
  getAgriculturalFormTemplate(id: number): Promise<AgriculturalFormTemplate | undefined>;
  updateAgriculturalFormTemplate(id: number, updates: Partial<InsertAgriculturalFormTemplate>): Promise<AgriculturalFormTemplate | undefined>;
  deleteAgriculturalFormTemplate(id: number): Promise<void>;
  
  // Agricultural Form Response operations
  createAgriculturalFormResponse(response: InsertAgriculturalFormResponse): Promise<AgriculturalFormResponse>;
  getAgriculturalFormResponse(templateId: number, applicationId: number): Promise<AgriculturalFormResponse | undefined>;
  getAgriculturalFormResponseByApplication(applicationId: number): Promise<AgriculturalFormResponse | undefined>;
  getAgriculturalFormResponseById(id: number): Promise<AgriculturalFormResponse | undefined>;
  updateAgriculturalFormResponse(id: number, updates: Partial<InsertAgriculturalFormResponse>): Promise<AgriculturalFormResponse | undefined>;
  
  // Bulk operations for CSV export
  getAgriculturalFormResponsesForApplications(applicationIds: number[]): Promise<AgriculturalFormResponse[]>;
  getDocumentsForApplications(applicationIds: number[]): Promise<Document[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      console.error("upsertUser error:", error.code, error.constraint, error.message);
      
      // Handle email unique constraint violation
      if (error.code === '23505' && error.constraint === 'users_email_unique') {
        // Email already exists, find the existing user and update their data
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, userData.email!));
        
        if (existingUser) {
          // Update the existing user with new data (excluding ID to avoid FK violations)
          const [updatedUser] = await db
            .update(users)
            .set({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id))
            .returning();
          return updatedUser;
        }
      }
      
      // Handle foreign key constraint violation - user already exists with related data
      if (error.code === '23503') {
        // Find existing user by ID and just update non-ID fields
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userData.id));
        
        if (existingUser) {
          const [updatedUser] = await db
            .update(users)
            .set({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userData.id))
            .returning();
          return updatedUser;
        }
      }
      
      throw error;
    }
  }

  // Grant Application operations
  async createGrantApplication(application: InsertGrantApplication): Promise<GrantApplication> {
    const [newApplication] = await db
      .insert(grantApplications)
      .values(application)
      .returning();
    return newApplication;
  }

  async getGrantApplication(id: number): Promise<GrantApplication | undefined> {
    const [application] = await db
      .select()
      .from(grantApplications)
      .where(eq(grantApplications.id, id));
    return application;
  }

  async getUserGrantApplications(userId: string): Promise<GrantApplication[]> {
    return await db
      .select()
      .from(grantApplications)
      .where(eq(grantApplications.userId, userId))
      .orderBy(desc(grantApplications.createdAt));
  }

  async getUserGrantApplicationForYear(userId: string, year: number): Promise<GrantApplication | undefined> {
    const [application] = await db
      .select()
      .from(grantApplications)
      .where(
        and(
          eq(grantApplications.userId, userId),
          eq(grantApplications.year, year)
        )
      );
    return application;
  }

  async getAllGrantApplications(): Promise<GrantApplication[]> {
    return await db
      .select()
      .from(grantApplications)
      .orderBy(desc(grantApplications.createdAt));
  }

  async getGrantApplicationsByStatus(status: string): Promise<GrantApplication[]> {
    return await db
      .select()
      .from(grantApplications)
      .where(eq(grantApplications.status, status))
      .orderBy(desc(grantApplications.createdAt));
  }

  // Admin-specific methods that include user data
  async getAllGrantApplicationsWithUserData(): Promise<ApplicationWithUserData[]> {
    return await db
      .select({
        id: grantApplications.id,
        userId: grantApplications.userId,
        status: grantApplications.status,
        year: grantApplications.year,
        progressPercentage: grantApplications.progressPercentage,
        agriculturalReturnCompleted: grantApplications.agriculturalReturnCompleted,
        landDeclarationCompleted: grantApplications.landDeclarationCompleted,
        consentFormCompleted: grantApplications.consentFormCompleted,
        supportingDocsCompleted: grantApplications.supportingDocsCompleted,
        digitalSignature: grantApplications.digitalSignature,
        submittedAt: grantApplications.submittedAt,
        createdAt: grantApplications.createdAt,
        updatedAt: grantApplications.updatedAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(grantApplications)
      .leftJoin(users, eq(grantApplications.userId, users.id))
      .orderBy(desc(grantApplications.createdAt));
  }

  async getGrantApplicationsByStatusWithUserData(status: string): Promise<ApplicationWithUserData[]> {
    return await db
      .select({
        id: grantApplications.id,
        userId: grantApplications.userId,
        status: grantApplications.status,
        year: grantApplications.year,
        progressPercentage: grantApplications.progressPercentage,
        agriculturalReturnCompleted: grantApplications.agriculturalReturnCompleted,
        landDeclarationCompleted: grantApplications.landDeclarationCompleted,
        consentFormCompleted: grantApplications.consentFormCompleted,
        supportingDocsCompleted: grantApplications.supportingDocsCompleted,
        digitalSignature: grantApplications.digitalSignature,
        submittedAt: grantApplications.submittedAt,
        createdAt: grantApplications.createdAt,
        updatedAt: grantApplications.updatedAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(grantApplications)
      .leftJoin(users, eq(grantApplications.userId, users.id))
      .where(eq(grantApplications.status, status))
      .orderBy(desc(grantApplications.createdAt));
  }

  async getGrantApplicationsWithUserDataFiltered(status?: string, startDate?: Date, endDate?: Date): Promise<ApplicationWithUserData[]> {
    // Build the where conditions
    const conditions = [];
    
    if (status) {
      conditions.push(eq(grantApplications.status, status));
    }
    
    if (startDate) {
      conditions.push(gte(grantApplications.createdAt, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(grantApplications.createdAt, endDate));
    }

    return await db
      .select({
        id: grantApplications.id,
        userId: grantApplications.userId,
        status: grantApplications.status,
        year: grantApplications.year,
        progressPercentage: grantApplications.progressPercentage,
        agriculturalReturnCompleted: grantApplications.agriculturalReturnCompleted,
        landDeclarationCompleted: grantApplications.landDeclarationCompleted,
        consentFormCompleted: grantApplications.consentFormCompleted,
        supportingDocsCompleted: grantApplications.supportingDocsCompleted,
        digitalSignature: grantApplications.digitalSignature,
        submittedAt: grantApplications.submittedAt,
        createdAt: grantApplications.createdAt,
        updatedAt: grantApplications.updatedAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(grantApplications)
      .leftJoin(users, eq(grantApplications.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(grantApplications.createdAt));
  }

  async updateGrantApplication(id: number, updates: Partial<InsertGrantApplication>): Promise<GrantApplication | undefined> {
    const [updated] = await db
      .update(grantApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(grantApplications.id, id))
      .returning();
    return updated;
  }

  async deleteGrantApplication(id: number): Promise<boolean> {
    try {
      // Delete related records first due to foreign key constraints
      await db.delete(agriculturalFormResponses).where(eq(agriculturalFormResponses.applicationId, id));
      await db.delete(documents).where(eq(documents.applicationId, id));
      await db.delete(agriculturalReturns).where(eq(agriculturalReturns.applicationId, id));
      
      // Delete the application
      const [deleted] = await db
        .delete(grantApplications)
        .where(eq(grantApplications.id, id))
        .returning();
      
      return !!deleted;
    } catch (error) {
      console.error("Error deleting grant application:", error);
      return false;
    }
  }

  // Agricultural Return operations
  async createAgriculturalReturn(agriculturalReturn: InsertAgriculturalReturn): Promise<AgriculturalReturn> {
    const [newReturn] = await db
      .insert(agriculturalReturns)
      .values(agriculturalReturn)
      .returning();
    return newReturn;
  }

  async getAgriculturalReturnByApplicationId(applicationId: number): Promise<AgriculturalReturn | undefined> {
    const [agriculturalReturn] = await db
      .select()
      .from(agriculturalReturns)
      .where(eq(agriculturalReturns.applicationId, applicationId));
    return agriculturalReturn;
  }

  async updateAgriculturalReturn(id: number, updates: Partial<InsertAgriculturalReturn>): Promise<AgriculturalReturn | undefined> {
    const [updated] = await db
      .update(agriculturalReturns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agriculturalReturns.id, id))
      .returning();
    return updated;
  }

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByApplicationId(applicationId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.applicationId, applicationId));
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Agricultural Form Template operations
  async createAgriculturalFormTemplate(template: InsertAgriculturalFormTemplate): Promise<AgriculturalFormTemplate> {
    const [newTemplate] = await db
      .insert(agriculturalFormTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getAgriculturalFormTemplates(): Promise<AgriculturalFormTemplate[]> {
    return await db
      .select()
      .from(agriculturalFormTemplates)
      .orderBy(desc(agriculturalFormTemplates.createdAt));
  }

  async getActiveAgriculturalFormTemplates(): Promise<AgriculturalFormTemplate[]> {
    return await db
      .select()
      .from(agriculturalFormTemplates)
      .where(eq(agriculturalFormTemplates.isActive, true))
      .orderBy(desc(agriculturalFormTemplates.year));
  }

  async getAgriculturalFormTemplate(id: number): Promise<AgriculturalFormTemplate | undefined> {
    const [template] = await db
      .select()
      .from(agriculturalFormTemplates)
      .where(eq(agriculturalFormTemplates.id, id));
    return template;
  }

  async updateAgriculturalFormTemplate(id: number, updates: Partial<InsertAgriculturalFormTemplate>): Promise<AgriculturalFormTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(agriculturalFormTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agriculturalFormTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteAgriculturalFormTemplate(id: number): Promise<void> {
    await db.delete(agriculturalFormTemplates).where(eq(agriculturalFormTemplates.id, id));
  }

  // Agricultural Form Response operations
  async createAgriculturalFormResponse(response: InsertAgriculturalFormResponse): Promise<AgriculturalFormResponse> {
    const [newResponse] = await db
      .insert(agriculturalFormResponses)
      .values(response)
      .returning();
    return newResponse;
  }

  async getAgriculturalFormResponse(templateId: number, applicationId: number): Promise<AgriculturalFormResponse | undefined> {
    const [response] = await db
      .select()
      .from(agriculturalFormResponses)
      .where(
        and(
          eq(agriculturalFormResponses.templateId, templateId),
          eq(agriculturalFormResponses.applicationId, applicationId)
        )
      );
    return response;
  }

  async getAgriculturalFormResponseByApplication(applicationId: number): Promise<AgriculturalFormResponse | undefined> {
    const [response] = await db
      .select()
      .from(agriculturalFormResponses)
      .where(eq(agriculturalFormResponses.applicationId, applicationId))
      .orderBy(desc(agriculturalFormResponses.createdAt))
      .limit(1);
    return response;
  }

  async getAgriculturalFormResponseById(id: number): Promise<AgriculturalFormResponse | undefined> {
    const [response] = await db
      .select()
      .from(agriculturalFormResponses)
      .where(eq(agriculturalFormResponses.id, id));
    return response;
  }

  async updateAgriculturalFormResponse(id: number, updates: Partial<InsertAgriculturalFormResponse>): Promise<AgriculturalFormResponse | undefined> {
    const [updatedResponse] = await db
      .update(agriculturalFormResponses)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agriculturalFormResponses.id, id))
      .returning();
    return updatedResponse;
  }

  // Bulk operations for CSV export
  async getAgriculturalFormResponsesForApplications(applicationIds: number[]): Promise<AgriculturalFormResponse[]> {
    if (applicationIds.length === 0) return [];
    
    return await db
      .select()
      .from(agriculturalFormResponses)
      .where(inArray(agriculturalFormResponses.applicationId, applicationIds))
      .orderBy(desc(agriculturalFormResponses.createdAt));
  }

  async getDocumentsForApplications(applicationIds: number[]): Promise<Document[]> {
    if (applicationIds.length === 0) return [];
    
    return await db
      .select()
      .from(documents)
      .where(inArray(documents.applicationId, applicationIds))
      .orderBy(documents.applicationId, documents.uploadedAt);
  }
}

export const storage = new DatabaseStorage();
