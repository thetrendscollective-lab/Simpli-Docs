import type { Request, Response } from "express";
import { storage } from "../storage";

export const getDoc = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const document = await storage.getDocument(id);
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify session ownership
    if (document.sessionId !== sessionId) {
      return res.status(403).json({ error: "Unauthorized access to document" });
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ error: "Failed to fetch document" });
  }
};

export const getDocText = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const document = await storage.getDocument(id);
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify session ownership
    if (document.sessionId !== sessionId) {
      return res.status(403).json({ error: "Unauthorized access to document" });
    }

    res.json({
      id: document.id,
      originalText: document.originalText,
      processedSections: document.processedSections,
      filename: document.filename,
      language: document.language
    });
  } catch (error) {
    console.error("Error fetching document text:", error);
    res.status(500).json({ error: "Failed to fetch document text" });
  }
};

export const getLatestDocId = async (req: Request, res: Response) => {
  try {
    const latestDoc = await storage.getLatestDocument();
    
    if (!latestDoc) {
      return res.status(404).json({ error: "no docs yet" });
    }
    
    res.json({ id: latestDoc.id });
  } catch (error) {
    console.error("Error fetching latest doc ID:", error);
    res.status(500).json({ error: "Failed to fetch latest document ID" });
  }
};