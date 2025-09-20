import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { OpenAIService } from "./services/openai";
import { DocumentProcessor } from "./services/documentProcessor";
import { OCRService } from "./services/ocrService";
import { insertDocumentSchema, insertQASchema } from "@shared/schema";
import { randomUUID } from "crypto";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, TXT, PNG, and JPG files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const openaiService = new OpenAIService();
  const documentProcessor = new DocumentProcessor();
  const ocrService = new OCRService();

  // Generate session ID for new sessions
  app.post("/api/session", async (req, res) => {
    try {
      const sessionId = randomUUID();
      res.json({ sessionId });
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Upload and process document
  app.post("/api/documents/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { sessionId, language = 'en' } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const { originalname, mimetype, size, buffer } = req.file;
      let extractedText = '';

      // Extract text based on file type
      if (ocrService.isImageFile(mimetype)) {
        extractedText = await ocrService.extractTextFromImage(buffer, mimetype);
      } else if (mimetype === 'application/pdf') {
        try {
          const result = await documentProcessor.extractTextFromPDF(buffer);
          extractedText = result.text;
        } catch (error) {
          // If PDF text extraction fails, try OCR
          console.warn("PDF text extraction failed, trying OCR:", error.message);
          extractedText = await ocrService.extractTextFromScannedPDF(buffer);
        }
      } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        extractedText = await documentProcessor.extractTextFromDOCX(buffer);
      } else if (mimetype === 'text/plain') {
        extractedText = documentProcessor.extractTextFromTXT(buffer);
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      if (!extractedText.trim()) {
        return res.status(400).json({ error: "No text could be extracted from the document" });
      }

      // Process document sections
      const sections = documentProcessor.parseDocumentSections(extractedText);
      const documentType = documentProcessor.detectDocumentType(extractedText);

      // Create document record
      const documentData = insertDocumentSchema.parse({
        sessionId,
        filename: originalname,
        fileType: mimetype,
        fileSize: size,
        originalText: extractedText,
        processedSections: sections,
        language
      });

      const document = await storage.createDocument(documentData);
      
      res.json({
        documentId: document.id,
        filename: originalname,
        fileSize: size,
        pageCount: sections.reduce((max, section) => 
          Math.max(max, ...section.pageNumbers), 0
        ),
        documentType,
        sections: sections.map(s => ({
          id: s.id,
          title: s.title,
          pageNumbers: s.pageNumbers,
          type: s.type
        }))
      });

    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({ 
        error: error.message || "Failed to process document" 
      });
    }
  });

  // Generate summary for document
  app.post("/api/documents/:id/summarize", async (req, res) => {
    try {
      const { id } = req.params;
      const { language = 'en' } = req.body;

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (!document.originalText) {
        return res.status(400).json({ error: "No text available for summarization" });
      }

      const documentType = documentProcessor.detectDocumentType(document.originalText);
      const summary = await openaiService.summarizeDocument(
        document.originalText,
        documentType,
        language
      );

      // Update document with summary
      await storage.updateDocument(id, { summary: JSON.stringify(summary) });

      res.json(summary);

    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate summary" 
      });
    }
  });

  // Generate glossary for document
  app.post("/api/documents/:id/glossary", async (req, res) => {
    try {
      const { id } = req.params;
      const { language = 'en' } = req.body;

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (!document.originalText) {
        return res.status(400).json({ error: "No text available for glossary extraction" });
      }

      const glossaryResult = await openaiService.extractGlossary(
        document.originalText,
        language
      );

      // Update document with glossary
      await storage.updateDocument(id, { glossary: glossaryResult.terms });

      res.json(glossaryResult.terms);

    } catch (error) {
      console.error("Error generating glossary:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate glossary" 
      });
    }
  });

  // Ask question about document
  app.post("/api/documents/:id/ask", async (req, res) => {
    try {
      const { id } = req.params;
      const { question, language = 'en' } = req.body;

      if (!question?.trim()) {
        return res.status(400).json({ error: "Question is required" });
      }

      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (!document.processedSections) {
        return res.status(400).json({ error: "Document sections not available" });
      }

      // Create chunks for similarity search (simplified version)
      const chunks = documentProcessor.createDocumentChunks(
        document.processedSections as any[]
      );

      // For MVP, use all chunks (in production, implement similarity search)
      const result = await openaiService.answerQuestion(question, chunks, language);

      // Store Q&A interaction
      const qaData = insertQASchema.parse({
        documentId: id,
        question,
        answer: result.answer,
        citations: result.citations
      });

      await storage.createQA(qaData);

      res.json(result);

    } catch (error) {
      console.error("Error answering question:", error);
      res.status(500).json({ 
        error: error.message || "Failed to answer question" 
      });
    }
  });

  // Get document details
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocument(id);
      
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Get Q&A history for document
  app.get("/api/documents/:id/qa", async (req, res) => {
    try {
      const { id } = req.params;
      const qaHistory = await storage.getQAByDocument(id);
      res.json(qaHistory);
    } catch (error) {
      console.error("Error fetching Q&A history:", error);
      res.status(500).json({ error: "Failed to fetch Q&A history" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDocument(id);
      
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Cleanup session
  app.delete("/api/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      await storage.cleanupSession(sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error cleaning up session:", error);
      res.status(500).json({ error: "Failed to cleanup session" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
