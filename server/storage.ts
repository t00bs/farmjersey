import {
  users,
  grantApplications,
  agriculturalReturns,
  documents,
  type User,
  type UpsertUser,
  type GrantApplication,
  type InsertGrantApplication,
  type AgriculturalReturn,
  type InsertAgriculturalReturn,
  type Document,
  type InsertDocument,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
  getAllGrantApplications(): Promise<GrantApplication[]>;
  getGrantApplicationsByStatus(status: string): Promise<GrantApplication[]>;
  updateGrantApplication(id: number, updates: Partial<InsertGrantApplication>): Promise<GrantApplication | undefined>;
  
  // Agricultural Return operations
  createAgriculturalReturn(agriculturalReturn: InsertAgriculturalReturn): Promise<AgriculturalReturn>;
  getAgriculturalReturnByApplicationId(applicationId: number): Promise<AgriculturalReturn | undefined>;
  updateAgriculturalReturn(id: number, updates: Partial<InsertAgriculturalReturn>): Promise<AgriculturalReturn | undefined>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByApplicationId(applicationId: number): Promise<Document[]>;
  deleteDocument(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
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

  async updateGrantApplication(id: number, updates: Partial<InsertGrantApplication>): Promise<GrantApplication | undefined> {
    const [updated] = await db
      .update(grantApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(grantApplications.id, id))
      .returning();
    return updated;
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

  async getDocumentsByApplicationId(applicationId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.applicationId, applicationId));
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }
}

export const storage = new DatabaseStorage();
