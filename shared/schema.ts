import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table - NO LONGER USED with Supabase Auth
// Keeping for reference but will be removed
// export const sessions = pgTable(
//   "sessions",
//   {
//     sid: varchar("sid").primaryKey(),
//     sess: jsonb("sess").notNull(),
//     expire: timestamp("expire").notNull(),
//   },
//   (table) => [index("IDX_session_expire").on(table.expire)],
// );

// User storage table.
// Now references Supabase auth.users (UUID-based)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // 'admin' or 'user'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Grant Applications
export const grantApplications = pgTable("grant_applications", {
  id: serial("id").primaryKey(),
  publicId: varchar("public_id", { length: 12 }).unique().notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("draft"), // draft, in_progress, submitted, approved, rejected
  year: integer("year").notNull(),
  progressPercentage: integer("progress_percentage").notNull().default(0),
  agriculturalReturnCompleted: boolean("agricultural_return_completed").default(false),
  landDeclarationCompleted: boolean("land_declaration_completed").default(false),
  consentFormCompleted: boolean("consent_form_completed").default(false),
  supportingDocsCompleted: boolean("supporting_docs_completed").default(false),
  digitalSignature: text("digital_signature"),
  consentName: varchar("consent_name"),
  consentAddress: text("consent_address"),
  consentFarmCode: varchar("consent_farm_code"),
  consentEmail: varchar("consent_email"),
  resubmissionReason: text("resubmission_reason"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agricultural Returns - Combined form matching RSS Agricultural Return 2026
export const agriculturalReturns = pgTable("agricultural_returns", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => grantApplications.id),
  
  // Legacy fields (kept for backward compatibility)
  cropData: jsonb("crop_data"), // JSON data for crop details
  landUsage: jsonb("land_usage"), // JSON data for land usage
  totalAcres: integer("total_acres"),
  
  // Section A - Farm Details
  farmDetailsData: jsonb("farm_details_data"), // { farmName, addressLine1, addressLine2, parish, postcode, telephone, email }
  
  // Section G - Financial Declaration (moved from B)
  financialData: jsonb("financial_data"), // { produceSalesExport, produceSalesLocal, servicesRental, grantsSupport, otherIncome, totalIncome, wagesSalaries, itis, socialSecurity, propertyRental, allOtherExpenses, tradingProfit }
  
  // Section D - Land and Facilities (moved from C)
  facilitiesData: jsonb("facilities_data"), // { pesticideStoreCount, pesticideStoreAddress, slurryStoreCount, slurryCapacityLitres }
  
  // Section E - Farm Livestock (moved from D)
  livestockData: jsonb("livestock_data"), // { pigs, sheep, goats, chickens, otherFowl, horsesOwned, horsesLivery, donkeysMules, other, otherSpecify }
  
  // Section B - Accreditation
  accreditationData: jsonb("accreditation_data"), // { leafOption, organicOption, otherCertifications: { brcGlobal, globalGap, redTractor, salsa, kiwa, britishHorseSociety } }
  
  // Section C - Integrated Farm Management Plans (checkboxes) - moved from E
  managementPlans: jsonb("management_plans"), // { soilPlan, waterPlan, nutrientPlan, wastePlan, animalHealthPlan, conservationPlan, energyAudit, carbonNetZeroPlan, carbonDataCollection, woodlandPlan, dairyWelfareVet, healthSafetyPlan }
  
  // Section F - Tier 3 - moved from G
  tier3Data: jsonb("tier3_data"), // { eatSafeStars, genuineJerseyMember, greatTasteProducts, farmOpenDays, publicFootpathsMeters, wildlifePonds, wasteRecyclingTonnes }
  
  // Section H - Declaration & Signature
  declarationName: varchar("declaration_name"),
  declarationDate: timestamp("declaration_date"),
  declarationSignature: text("declaration_signature"), // Base64 encoded canvas signature
  
  // Form completion tracking
  isComplete: boolean("is_complete").default(false),
  completedSections: jsonb("completed_sections"), // Track which sections are done
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => grantApplications.id),
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: varchar("file_path").notNull(),
  documentType: varchar("document_type").notNull(), // land_declaration, supporting_doc, etc.
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  grantApplications: many(grantApplications),
}));

export const grantApplicationRelations = relations(grantApplications, ({ one, many }) => ({
  user: one(users, {
    fields: [grantApplications.userId],
    references: [users.id],
  }),
  agriculturalReturn: one(agriculturalReturns, {
    fields: [grantApplications.id],
    references: [agriculturalReturns.applicationId],
  }),
  documents: many(documents),
}));

export const agriculturalReturnRelations = relations(agriculturalReturns, ({ one }) => ({
  application: one(grantApplications, {
    fields: [agriculturalReturns.applicationId],
    references: [grantApplications.id],
  }),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  application: one(grantApplications, {
    fields: [documents.applicationId],
    references: [grantApplications.id],
  }),
}));

// Insert Schemas
export const insertGrantApplicationSchema = createInsertSchema(grantApplications).omit({
  id: true,
  publicId: true,
  createdAt: true,
  updatedAt: true,
});

// Utility function to generate random public IDs (8 characters, alphanumeric)
export function generatePublicId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // Removed confusing chars like 0, O, 1, l, I
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const insertAgriculturalReturnSchema = createInsertSchema(agriculturalReturns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type GrantApplication = typeof grantApplications.$inferSelect;
export type InsertGrantApplication = z.infer<typeof insertGrantApplicationSchema>;
export type AgriculturalReturn = typeof agriculturalReturns.$inferSelect;
export type InsertAgriculturalReturn = z.infer<typeof insertAgriculturalReturnSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Agricultural Form Templates
export const agriculturalFormTemplates = pgTable("agricultural_form_templates", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  year: integer("year").notNull(),
  sections: jsonb("sections").notNull(), // Array of FormSection objects
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agriculturalFormTemplateRelations = relations(agriculturalFormTemplates, ({ many }) => ({
  responses: many(agriculturalFormResponses),
}));

// Agricultural Form Responses
export const agriculturalFormResponses = pgTable("agricultural_form_responses", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => agriculturalFormTemplates.id),
  applicationId: integer("application_id").notNull().references(() => grantApplications.id),
  responses: jsonb("responses").notNull(), // Field responses as key-value pairs
  isComplete: boolean("is_complete").default(false),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agriculturalFormResponseRelations = relations(agriculturalFormResponses, ({ one }) => ({
  template: one(agriculturalFormTemplates, {
    fields: [agriculturalFormResponses.templateId],
    references: [agriculturalFormTemplates.id],
  }),
  application: one(grantApplications, {
    fields: [agriculturalFormResponses.applicationId],
    references: [grantApplications.id],
  }),
}));

export const insertAgriculturalFormTemplateSchema = createInsertSchema(agriculturalFormTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgriculturalFormResponseSchema = createInsertSchema(agriculturalFormResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AgriculturalFormTemplate = typeof agriculturalFormTemplates.$inferSelect;
export type InsertAgriculturalFormTemplate = z.infer<typeof insertAgriculturalFormTemplateSchema>;
export type AgriculturalFormResponse = typeof agriculturalFormResponses.$inferSelect;
export type InsertAgriculturalFormResponse = z.infer<typeof insertAgriculturalFormResponseSchema>;

// Invitations
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  token: varchar("token").notNull().unique(),
  used: boolean("used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

// Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  token: varchar("token").notNull().unique(),
  used: boolean("used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

// Admin-specific types that include user data
export interface ApplicationWithUserData extends GrantApplication {
  userFirstName?: string | null;
  userLastName?: string | null;
  userEmail?: string | null;
}
