import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Referenced from javascript_log_in_with_replit integration
// Session storage table (IMPORTANT: mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Referenced from javascript_log_in_with_replit integration  
// User storage table (IMPORTANT: mandatory for Replit Auth, updated with Stripe fields)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Stripe subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  subscriptionStatus: varchar("subscription_status"), // 'active', 'canceled', 'past_due', 'trialing', 'inactive'
  currentPlan: varchar("current_plan"), // 'free', 'standard', 'pro', 'family'
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stripe subscriptions tracking table
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  stripePriceId: varchar("stripe_price_id").notNull(),
  status: varchar("status").notNull(), // 'active', 'canceled', 'past_due', 'trialing', 'unpaid'
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  detectedLanguage: text("detected_language"),
  confidence: integer("confidence"), // 0-100 percentage
  pageCount: integer("page_count").default(1),
  paymentAmount: integer("payment_amount"), // Amount in cents
  paymentStatus: text("payment_status").default("pending"), // pending, paid, failed
  stripePaymentIntentId: text("stripe_payment_intent_id"),
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

export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull().unique(),
  documentCount: integer("document_count").notNull().default(0),
  monthYear: text("month_year").notNull(), // Format: "YYYY-MM"
  lastResetAt: timestamp("last_reset_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
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

export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({
  id: true,
  lastResetAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertQA = z.infer<typeof insertQASchema>;
export type QAInteraction = typeof qaInteractions.$inferSelect;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;

// Referenced from javascript_log_in_with_replit integration
// (IMPORTANT) UpsertUser and User types are mandatory for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

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
