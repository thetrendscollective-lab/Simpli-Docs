import { type User, type InsertUser, type Document, type InsertDocument, type QAInteraction, type InsertQA, type UsageTracking, type InsertUsageTracking } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const now = new Date();
    const document: Document = { 
      ...doc, 
      id,
      summary: doc.summary ?? null,
      glossary: doc.glossary ?? null,
      language: doc.language ?? null,
      originalText: doc.originalText ?? null,
      processedSections: doc.processedSections ?? null,
      pageCount: doc.pageCount ?? 1,
      paymentAmount: doc.paymentAmount ?? null,
      paymentStatus: doc.paymentStatus ?? null,
      stripePaymentIntentId: doc.stripePaymentIntentId ?? null,
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
    
    const usage = this.usageTracking.get(ipAddress);
    
    // If no usage record or it's from a previous month, allow and reset
    if (!usage || usage.monthYear !== currentMonthYear) {
      return { allowed: true, remaining: monthlyLimit - 1 };
    }
    
    // Check if under limit
    const remaining = Math.max(0, monthlyLimit - usage.documentCount);
    return { allowed: usage.documentCount < monthlyLimit, remaining };
  }
}

export const storage = new MemStorage();
