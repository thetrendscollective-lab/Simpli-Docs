import { type User, type InsertUser, type Document, type InsertDocument, type QAInteraction, type InsertQA } from "@shared/schema";
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
  
  // QA methods
  createQA(qa: InsertQA): Promise<QAInteraction>;
  getQAByDocument(documentId: string): Promise<QAInteraction[]>;
  
  // Session cleanup
  cleanupSession(sessionId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private qaInteractions: Map<string, QAInteraction>;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.qaInteractions = new Map();
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
}

export const storage = new MemStorage();
