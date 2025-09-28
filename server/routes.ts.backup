import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Stripe from "stripe";
import { storage } from "./storage";
import { OpenAIService } from "./services/openai";
import { DocumentProcessor } from "./services/documentProcessor";
import { OCRService } from "./services/ocrService";
import { insertDocumentSchema, insertQASchema } from "@shared/schema";
import { calculateDocumentPrice } from "@shared/pricing";
import { randomUUID } from "crypto";
import { getErrorMessage } from "./utils";

// Initialize Stripe - Referenced from javascript_stripe integration
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
          console.warn("PDF text extraction failed, trying OCR:", getErrorMessage(error));
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
      
      // Calculate page count from sections
      const pageCount = Math.max(1, sections.reduce((max, section) => 
        Math.max(max, ...section.pageNumbers), 1
      ));

      // Calculate pricing for this document
      const pricing = calculateDocumentPrice(pageCount);

      // Create document record with payment info
      const documentData = insertDocumentSchema.parse({
        sessionId,
        filename: originalname,
        fileType: mimetype,
        fileSize: size,
        originalText: extractedText,
        processedSections: sections,
        language,
        pageCount,
        paymentAmount: pricing.totalCents,
        paymentStatus: "pending"
      });

      const document = await storage.createDocument(documentData);
      
      res.json({
        documentId: document.id,
        filename: originalname,
        fileSize: size,
        pageCount,
        documentType,
        pricing: {
          basePrice: pricing.basePrice,
          perPagePrice: pricing.perPagePrice,
          totalPrice: pricing.totalPrice,
          totalCents: pricing.totalCents
        },
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
        error: getErrorMessage(error) || "Failed to process document" 
      });
    }
  });

  // Generate summary for document
  app.post("/api/documents/:id/summarize", async (req, res) => {
    try {
      const { id } = req.params;
      const { language = 'en' } = req.body;
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

      // Check payment status before allowing processing
      if (document.paymentStatus !== "paid") {
        return res.status(402).json({ 
          error: "Payment required", 
          message: "Please complete payment to access document processing features",
          paymentStatus: document.paymentStatus 
        });
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
        error: getErrorMessage(error) || "Failed to generate summary" 
      });
    }
  });

  // Generate glossary for document
  app.post("/api/documents/:id/glossary", async (req, res) => {
    try {
      const { id } = req.params;
      const { language = 'en' } = req.body;
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

      // Check payment status before allowing processing
      if (document.paymentStatus !== "paid") {
        return res.status(402).json({ 
          error: "Payment required", 
          message: "Please complete payment to access document processing features",
          paymentStatus: document.paymentStatus 
        });
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
        error: getErrorMessage(error) || "Failed to generate glossary" 
      });
    }
  });

  // Ask question about document
  app.post("/api/documents/:id/ask", async (req, res) => {
    try {
      const { id } = req.params;
      const { question, language = 'en' } = req.body;
      const sessionId = req.headers['x-session-id'] as string;

      if (!question?.trim()) {
        return res.status(400).json({ error: "Question is required" });
      }

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

      // Check payment status before allowing processing
      if (document.paymentStatus !== "paid") {
        return res.status(402).json({ 
          error: "Payment required", 
          message: "Please complete payment to access document processing features",
          paymentStatus: document.paymentStatus 
        });
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
        error: getErrorMessage(error) || "Failed to answer question" 
      });
    }
  });

  // Get document details
  app.get("/api/documents/:id", async (req, res) => {
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
  });

  // Get Q&A history for document
  app.get("/api/documents/:id/qa", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Verify document exists and session ownership
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Verify session ownership
      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

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

      const success = await storage.deleteDocument(id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to delete document" });
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

  // Stripe payment route for one-time payments - Referenced from javascript_stripe integration
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { documentId } = req.body;
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Get document to verify payment amount server-side and session ownership
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Verify session ownership
      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

      if (!document.paymentAmount) {
        return res.status(400).json({ error: "Payment amount not calculated for document" });
      }

      // Create payment intent with server-side calculated amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: document.paymentAmount, // Already in cents from upload
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          documentId: documentId,
          sessionId: sessionId
        }
      });

      // Update document with payment intent ID
      await storage.updateDocumentPayment(documentId, {
        stripePaymentIntentId: paymentIntent.id,
        paymentStatus: "pending"
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ 
        error: "Error creating payment intent: " + getErrorMessage(error) 
      });
    }
  });

  // Verify payment and enable document processing
  app.post("/api/documents/:documentId/verify-payment", async (req, res) => {
    try {
      const { documentId } = req.params;
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Verify session ownership
      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

      if (!document.stripePaymentIntentId) {
        return res.status(400).json({ error: "No payment intent found for document" });
      }

      // Retrieve payment intent from Stripe to verify status
      const paymentIntent = await stripe.paymentIntents.retrieve(document.stripePaymentIntentId);
      
      // Validate payment intent metadata matches document
      if (paymentIntent.metadata.documentId !== documentId) {
        return res.status(400).json({ error: "Payment intent does not match document" });
      }

      // Validate session matches to prevent cross-session reuse
      if (paymentIntent.metadata.sessionId !== sessionId) {
        return res.status(400).json({ error: "Payment intent session mismatch" });
      }

      // Validate amount and currency matches (prevent payment intent reuse)
      if (paymentIntent.amount !== document.paymentAmount) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      if (paymentIntent.currency !== "usd") {
        return res.status(400).json({ error: "Payment currency mismatch" });
      }

      if (paymentIntent.status === "succeeded") {
        // Update document payment status (idempotent)
        await storage.updateDocumentPayment(documentId, {
          paymentStatus: "paid"
        });
        
        res.json({ 
          paymentStatus: "paid",
          message: "Payment verified successfully" 
        });
      } else {
        res.json({ 
          paymentStatus: paymentIntent.status,
          message: "Payment not yet completed" 
        });
      }
    } catch (error: any) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ 
        error: "Error verifying payment: " + getErrorMessage(error) 
      });
    }
  });

  // New API endpoints for the DocResult component
  app.get("/api/explanations/:id", async (req, res) => {
    try {
      const { id: documentId } = req.params;
      const sessionId = req.headers['x-session-id'] as string;

      if (!sessionId) {
        return res.status(401).json({ error: "Session ID required" });
      }

      const document = await storage.getDocument(documentId);
      if (!document || document.sessionId !== sessionId) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Return explanation in the expected format
      const glossaryData = document.glossary ? (typeof document.glossary === 'string' ? JSON.parse(document.glossary) : document.glossary) : [];
      const explanation = {
        id: documentId,
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
  });

  app.post("/api/explain", async (req, res) => {
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

      // If document doesn't have summary/glossary yet, generate them
      if (!document.summary) {
        // Generate summary using existing endpoint pattern
        const summaryResponse = await fetch(`http://localhost:5000/api/documents/${document_id}/summarize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          }
        });
        
        if (!summaryResponse.ok) {
          throw new Error("Failed to generate summary");
        }
      }

      const glossaryData = document.glossary ? (typeof document.glossary === 'string' ? JSON.parse(document.glossary) : document.glossary) : [];
      if (!glossaryData || !Array.isArray(glossaryData) || glossaryData.length === 0) {
        // Generate glossary using existing endpoint pattern
        const glossaryResponse = await fetch(`http://localhost:5000/api/documents/${document_id}/glossary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          }
        });
        
        if (!glossaryResponse.ok) {
          throw new Error("Failed to generate glossary");
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error creating explanation:", error);
      res.status(500).json({ error: "Failed to create explanation" });
    }
  });

  // Quick test endpoint to get latest document ID  
  app.get("/api/docs/latest-id", async (_req, res) => {
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
  });

  const httpServer = createServer(app);
  return httpServer;
}
