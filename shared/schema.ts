import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  originalText: text("original_text"),
  processedSections: jsonb("processed_sections"),
  summary: text("summary"),
  glossary: jsonb("glossary"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const qaInteractions = pgTable("qa_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  citations: jsonb("citations"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQASchema = createInsertSchema(qaInteractions).omit({
  id: true,
  createdAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertQA = z.infer<typeof insertQASchema>;
export type QAInteraction = typeof qaInteractions.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Document processing types
export interface ProcessedSection {
  id: string;
  title: string;
  content: string;
  pageNumbers: number[];
  type: 'heading' | 'paragraph' | 'table' | 'list';
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  pageRefs: number[];
}

export interface Citation {
  pageNumber: number;
  sectionId: string;
  text: string;
}

export interface DocumentSummary {
  overview: string;
  keyFindings: string[];
  recommendations: string[];
  nextSteps: string[];
  riskFlags: string[];
}
