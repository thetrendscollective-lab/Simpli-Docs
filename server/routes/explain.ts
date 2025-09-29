import type { Request, Response } from "express";
import { storage } from "../storage";
import { OpenAIService } from "../services/openai";
import { DocumentProcessor } from "../services/documentProcessor";
import { insertQASchema } from "@shared/schema";
import { getErrorMessage } from "../utils";

const openaiService = new OpenAIService();
const documentProcessor = new DocumentProcessor();

export const postExplain = async (req: Request, res: Response) => {
  try {
    const { document_id, domain = "general" } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      return res.status(401).json({ error: "Session ID required" });
    }

    const document = await storage.getDocument(document_id);
    if (!document || document.sessionId !== sessionId) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check payment status before allowing processing (skip in development)
    const isDevelopment = process.env.NODE_ENV === "development";
    if (!isDevelopment && document.paymentStatus !== "paid") {
      return res.status(402).json({ 
        error: "Payment required", 
        message: "Please complete payment to access document processing features",
        paymentStatus: document.paymentStatus 
      });
    }

    // If document doesn't have summary/glossary yet, generate them
    if (!document.summary && document.originalText) {
      const documentType = documentProcessor.detectDocumentType(document.originalText);
      const summary = await openaiService.summarizeDocument(
        document.originalText,
        documentType,
        document.language || 'en'
      );
      await storage.updateDocument(document_id, { summary: JSON.stringify(summary) });
    }

    const glossaryData = document.glossary ? (typeof document.glossary === 'string' ? JSON.parse(document.glossary) : document.glossary) : [];
    if (!glossaryData || !Array.isArray(glossaryData) || glossaryData.length === 0) {
      if (document.originalText) {
        const glossaryResult = await openaiService.extractGlossary(
          document.originalText,
          document.language || 'en'
        );
        await storage.updateDocument(document_id, { glossary: glossaryResult.terms });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error creating explanation:", error);
    res.status(500).json({ error: "Failed to create explanation" });
  }
};

export const getExplanation = async (req: Request, res: Response) => {
  try {
    const { document_id } = req.params;
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      return res.status(401).json({ error: "Session ID required" });
    }

    const document = await storage.getDocument(document_id);
    if (!document || document.sessionId !== sessionId) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Return explanation in the expected format
    const glossaryData = document.glossary ? (typeof document.glossary === 'string' ? JSON.parse(document.glossary) : document.glossary) : [];
    const explanation = {
      id: document_id,
      summary: document.summary || "",
      bullet_points: [], // Extract from processedSections if needed
      glossary: Array.isArray(glossaryData) ? glossaryData.map((term: any) => ({
        term: term.term,
        meaning: term.definition
      })) : [],
      action_items: [], // Could be extracted from summary if needed
      confidence: 0.9, // Static confidence for now
      created_at: new Date().toISOString()
    };

    res.json(explanation);
  } catch (error) {
    console.error("Error fetching explanation:", error);
    res.status(500).json({ error: "Failed to fetch explanation" });
  }
};