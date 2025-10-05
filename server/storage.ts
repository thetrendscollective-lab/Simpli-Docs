import { type User, type UpsertUser, type Document, type InsertDocument, type QAInteraction, type InsertQA, type UsageTracking, type InsertUsageTracking } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, documents, qaInteractions, usageTracking } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Document methods
  createDocument(doc: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsBySession(sessionId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  
  // Payment methods
  updateDocumentPayment(id: string, paymentData: {
    stripePaymentIntentId?: string;
    paymentAmount?: number;
    paymentStatus?: string;
  }): Promise<Document | undefined>;
  
  // QA methods
  createQA(qa: InsertQA): Promise<QAInteraction>;
  getQAByDocument(documentId: string): Promise<QAInteraction[]>;
  
  // Session cleanup
  cleanupSession(sessionId: string): Promise<void>;
  
  // Get latest document
  getLatestDocument(): Promise<Document | undefined>;
  
  // Usage tracking methods
  getUsageByIP(ipAddress: string): Promise<UsageTracking | undefined>;
  incrementUsage(ipAddress: string): Promise<UsageTracking>;
  checkUsageLimit(ipAddress: string, monthlyLimit: number): Promise<{ allowed: boolean; remaining: number }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private qaInteractions: Map<string, QAInteraction>;
  private usageTracking: Map<string, UsageTracking>;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.qaInteractions = new Map();
    this.usageTracking = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const now = new Date();
    const existing = userData.id ? this.users.get(userData.id) : undefined;
    
    if (existing) {
      // Update existing user
      const user: User = {
        ...existing,
        ...userData,
        updatedAt: now,
      };
      this.users.set(user.id, user);
      return user;
    } else {
      // Create new user
      const id = userData.id || randomUUID();
      const user: User = {
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        stripeCustomerId: null,
        subscriptionStatus: null,
        currentPlan: null,
        currentPeriodEnd: null,
        createdAt: now,
        updatedAt: now,
        ...userData,
        id,
      };
      this.users.set(id, user);
      return user;
    }
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const now = new Date();
    const document: Document = { 
      ...doc, 
      id,
      summary: doc.summary ?? null,
      glossary: doc.glossary ?? null,
      actionItems: doc.actionItems ?? null,
      language: doc.language ?? null,
      detectedLanguage: doc.detectedLanguage ?? null,
      confidence: doc.confidence ?? null,
      originalText: doc.originalText ?? null,
      processedSections: doc.processedSections ?? null,
      pageCount: doc.pageCount ?? 1,
      paymentAmount: doc.paymentAmount ?? null,
      paymentStatus: doc.paymentStatus ?? null,
      stripePaymentIntentId: doc.stripePaymentIntentId ?? null,
      documentType: doc.documentType ?? null,
      eobData: doc.eobData ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.documents.set(id, document);
    return document;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentsBySession(sessionId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      doc => doc.sessionId === sessionId
    );
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;
    
    const updated: Document = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async createQA(qa: InsertQA): Promise<QAInteraction> {
    const id = randomUUID();
    const interaction: QAInteraction = {
      ...qa,
      id,
      documentId: qa.documentId ?? null,
      citations: qa.citations ?? null,
      confidence: qa.confidence ?? null,
      createdAt: new Date()
    };
    this.qaInteractions.set(id, interaction);
    return interaction;
  }

  async getQAByDocument(documentId: string): Promise<QAInteraction[]> {
    return Array.from(this.qaInteractions.values()).filter(
      qa => qa.documentId === documentId
    );
  }

  async updateDocumentPayment(id: string, paymentData: {
    stripePaymentIntentId?: string;
    paymentAmount?: number;
    paymentStatus?: string;
  }): Promise<Document | undefined> {
    return this.updateDocument(id, paymentData);
  }

  async cleanupSession(sessionId: string): Promise<void> {
    // Remove all documents for this session
    const sessionDocs = await this.getDocumentsBySession(sessionId);
    for (const doc of sessionDocs) {
      this.documents.delete(doc.id);
      
      // Remove associated QA interactions
      const qaInteractions = await this.getQAByDocument(doc.id);
      for (const qa of qaInteractions) {
        this.qaInteractions.delete(qa.id);
      }
    }
  }

  async getLatestDocument(): Promise<Document | undefined> {
    const allDocs = Array.from(this.documents.values());
    if (allDocs.length === 0) return undefined;
    
    // Sort by creation time (most recent first)
    return allDocs.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })[0];
  }

  async getUsageByIP(ipAddress: string): Promise<UsageTracking | undefined> {
    return this.usageTracking.get(ipAddress);
  }

  async incrementUsage(ipAddress: string): Promise<UsageTracking> {
    const currentDate = new Date();
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    let usage = this.usageTracking.get(ipAddress);
    
    if (!usage || usage.monthYear !== currentMonthYear) {
      // Create new usage record or reset for new month
      const id = randomUUID();
      usage = {
        id,
        ipAddress,
        documentCount: 1,
        monthYear: currentMonthYear,
        lastResetAt: currentDate,
        updatedAt: currentDate
      };
    } else {
      // Increment existing count
      usage = {
        ...usage,
        documentCount: usage.documentCount + 1,
        updatedAt: currentDate
      };
    }
    
    this.usageTracking.set(ipAddress, usage);
    return usage;
  }

  async checkUsageLimit(ipAddress: string, monthlyLimit: number): Promise<{ allowed: boolean; remaining: number }> {
    const currentDate = new Date();
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    let usage = this.usageTracking.get(ipAddress);
    
    // If no usage record or it's from a previous month, create/reset the record
    if (!usage || usage.monthYear !== currentMonthYear) {
      const id = randomUUID();
      usage = {
        id,
        ipAddress,
        documentCount: 0,
        monthYear: currentMonthYear,
        lastResetAt: currentDate,
        updatedAt: currentDate
      };
      this.usageTracking.set(ipAddress, usage);
      return { allowed: true, remaining: monthlyLimit };
    }
    
    // Check if under limit based on existing usage
    const remaining = Math.max(0, monthlyLimit - usage.documentCount);
    return { allowed: usage.documentCount < monthlyLimit, remaining };
  }
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const now = new Date();
    
    // Filter out undefined values to avoid DB errors
    const cleanData = Object.fromEntries(
      Object.entries(userData).filter(([_, v]) => v !== undefined)
    );
    
    const result = await db
      .insert(users)
      .values({ ...cleanData, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: users.id,
        set: { ...cleanData, updatedAt: now }
      })
      .returning();
    
    return result[0];
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const result = await db.insert(documents).values(doc).returning();
    return result[0];
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return result[0];
  }

  async getDocumentsBySession(sessionId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.sessionId, sessionId));
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const result = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    
    return result[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  async updateDocumentPayment(id: string, paymentData: {
    stripePaymentIntentId?: string;
    paymentAmount?: number;
    paymentStatus?: string;
  }): Promise<Document | undefined> {
    return this.updateDocument(id, paymentData);
  }

  async createQA(qa: InsertQA): Promise<QAInteraction> {
    const result = await db.insert(qaInteractions).values(qa).returning();
    return result[0];
  }

  async getQAByDocument(documentId: string): Promise<QAInteraction[]> {
    return await db.select().from(qaInteractions).where(eq(qaInteractions.documentId, documentId));
  }

  async cleanupSession(sessionId: string): Promise<void> {
    // Delete QA interactions for documents in this session
    const sessionDocs = await this.getDocumentsBySession(sessionId);
    for (const doc of sessionDocs) {
      await db.delete(qaInteractions).where(eq(qaInteractions.documentId, doc.id));
    }
    
    // Delete documents
    await db.delete(documents).where(eq(documents.sessionId, sessionId));
  }

  async getLatestDocument(): Promise<Document | undefined> {
    const result = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(1);
    return result[0];
  }

  async getUsageByIP(ipAddress: string): Promise<UsageTracking | undefined> {
    const result = await db.select().from(usageTracking).where(eq(usageTracking.ipAddress, ipAddress)).limit(1);
    return result[0];
  }

  async incrementUsage(ipAddress: string): Promise<UsageTracking> {
    const currentDate = new Date();
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const existing = await this.getUsageByIP(ipAddress);
    
    if (!existing || existing.monthYear !== currentMonthYear) {
      // Create new usage record or reset for new month
      const result = await db
        .insert(usageTracking)
        .values({
          ipAddress,
          documentCount: 1,
          monthYear: currentMonthYear,
          lastResetAt: currentDate,
          updatedAt: currentDate
        })
        .onConflictDoUpdate({
          target: usageTracking.ipAddress,
          set: {
            documentCount: 1,
            monthYear: currentMonthYear,
            lastResetAt: currentDate,
            updatedAt: currentDate
          }
        })
        .returning();
      
      return result[0];
    } else {
      // Increment existing count
      const result = await db
        .update(usageTracking)
        .set({
          documentCount: existing.documentCount + 1,
          updatedAt: currentDate
        })
        .where(eq(usageTracking.ipAddress, ipAddress))
        .returning();
      
      return result[0];
    }
  }

  async checkUsageLimit(ipAddress: string, monthlyLimit: number): Promise<{ allowed: boolean; remaining: number }> {
    const currentDate = new Date();
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    let usage = await this.getUsageByIP(ipAddress);
    
    // If no usage record or it's from a previous month, reset the record
    if (!usage || usage.monthYear !== currentMonthYear) {
      await db
        .insert(usageTracking)
        .values({
          ipAddress,
          documentCount: 0,
          monthYear: currentMonthYear,
          lastResetAt: currentDate,
          updatedAt: currentDate
        })
        .onConflictDoUpdate({
          target: usageTracking.ipAddress,
          set: {
            documentCount: 0,
            monthYear: currentMonthYear,
            lastResetAt: currentDate,
            updatedAt: currentDate
          }
        });
      
      return { allowed: true, remaining: monthlyLimit };
    }
    
    // Check if under limit based on existing usage
    const remaining = Math.max(0, monthlyLimit - usage.documentCount);
    return { allowed: usage.documentCount < monthlyLimit, remaining };
  }
}

// Use database storage in production, memory storage for testing
export const storage = process.env.NODE_ENV === 'test' ? new MemStorage() : new DbStorage();
