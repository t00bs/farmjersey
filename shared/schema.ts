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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Grant Applications
export const grantApplications = pgTable("grant_applications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("draft"), // draft, in_progress, submitted, approved, rejected
  year: integer("year").notNull(),
  progressPercentage: integer("progress_percentage").notNull().default(0),
  agriculturalReturnCompleted: boolean("agricultural_return_completed").default(false),
  landDeclarationCompleted: boolean("land_declaration_completed").default(false),
  consentFormCompleted: boolean("consent_form_completed").default(false),
  supportingDocsCompleted: boolean("supporting_docs_completed").default(false),
  digitalSignature: text("digital_signature"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agricultural Returns
export const agriculturalReturns = pgTable("agricultural_returns", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => grantApplications.id),
  cropData: jsonb("crop_data"), // JSON data for crop details
  landUsage: jsonb("land_usage"), // JSON data for land usage
  totalAcres: integer("total_acres"),
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
  createdAt: true,
  updatedAt: true,
});

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
