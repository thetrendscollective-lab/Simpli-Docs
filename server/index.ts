import express, { type Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { setupVite, serveStatic, log } from "./vite";
import { supabase } from "./services/supa";
import { uploadInit, uploadComplete } from "./routes/upload";
import { getDoc, getDocText, getLatestDocId } from "./routes/read";
import { postExplain, getExplanation } from "./routes/explain";
import docsRouter from "./routes/docs";
import apiRouter from "./routes/api";
import Stripe from "stripe";
import { storage } from "./storage";
import { OpenAIService } from "./services/openai";
import { DocumentProcessor } from "./services/documentProcessor";
import { insertQASchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { getErrorMessage } from "./utils";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const openaiService = new OpenAIService();
const documentProcessor = new DocumentProcessor();

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Mount the route handlers as specified
  app.post("/api/upload/init", uploadInit);
  app.post("/api/upload/complete", uploadComplete);
  app.get("/api/docs/:id", getDoc);
  app.get("/api/docs/:id/text", getDocText);
  app.post("/api/explain", postExplain);
  app.get("/api/explanations/:document_id", getExplanation);
  app.get("/api/docs/latest-id", getLatestDocId);

  // Compatibility route for frontend - maps old endpoint to new handler
  app.post("/api/documents/upload", uploadComplete);

  // Simplified docs upload route
  app.use("/api/docs", docsRouter);

  // Main processing route (consolidated)
  app.use("/api", apiRouter);

  // Session management
  app.post("/api/session", async (req, res) => {
    try {
      const sessionId = randomUUID();
      res.json({ sessionId });
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Stripe subscription checkout
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { priceId } = req.body;
      
      if (!priceId) {
        return res.status(400).json({ error: "Price ID is required" });
      }

      const origin = req.headers.origin || `http://localhost:5000`;
      
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ 
        error: "Error creating checkout session: " + getErrorMessage(error) 
      });
    }
  });

  // Document processing routes
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

      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

      const isDevelopment = process.env.NODE_ENV === "development";
      if (!isDevelopment && document.paymentStatus !== "paid") {
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

      await storage.updateDocument(id, { summary: JSON.stringify(summary) });
      res.json(summary);

    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ 
        error: getErrorMessage(error) || "Failed to generate summary" 
      });
    }
  });

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

      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

      const isDevelopment = process.env.NODE_ENV === "development";
      if (!isDevelopment && document.paymentStatus !== "paid") {
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

      await storage.updateDocument(id, { glossary: glossaryResult.terms });
      res.json(glossaryResult.terms);

    } catch (error) {
      console.error("Error generating glossary:", error);
      res.status(500).json({ 
        error: getErrorMessage(error) || "Failed to generate glossary" 
      });
    }
  });

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

      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

      const isDevelopment = process.env.NODE_ENV === "development";
      if (!isDevelopment && document.paymentStatus !== "paid") {
        return res.status(402).json({ 
          error: "Payment required", 
          message: "Please complete payment to access document processing features",
          paymentStatus: document.paymentStatus 
        });
      }

      if (!document.processedSections) {
        return res.status(400).json({ error: "Document sections not available" });
      }

      const chunks = documentProcessor.createDocumentChunks(
        document.processedSections as any[]
      );

      const result = await openaiService.answerQuestion(question, chunks, language);

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

  app.get("/api/documents/:id/qa", async (req, res) => {
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

  // Payment routes
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

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

      if (!document.paymentAmount) {
        return res.status(400).json({ error: "Payment amount not calculated for document" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: document.paymentAmount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          documentId: documentId,
          sessionId: sessionId
        }
      });

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

      if (document.sessionId !== sessionId) {
        return res.status(403).json({ error: "Unauthorized access to document" });
      }

      if (!document.stripePaymentIntentId) {
        return res.status(400).json({ error: "No payment intent found for document" });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(document.stripePaymentIntentId);
      
      if (paymentIntent.metadata.documentId !== documentId) {
        return res.status(400).json({ error: "Payment intent does not match document" });
      }

      if (paymentIntent.metadata.sessionId !== sessionId) {
        return res.status(400).json({ error: "Payment intent session mismatch" });
      }

      if (paymentIntent.amount !== document.paymentAmount) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      if (paymentIntent.currency !== "usd") {
        return res.status(400).json({ error: "Payment currency mismatch" });
      }

      if (paymentIntent.status === "succeeded") {
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

  // Create HTTP server
  const { createServer } = await import("http");
  const server = createServer(app);

  // tiny test page: shows if supabase works
  app.get("/test-conn", async (_req, res) => {
    if (!supabase) {
      return res.status(500).json({ message: "Supabase not configured", details: "Environment variables missing" });
    }
    
    const { data, error } = await supabase
      .from("simplydocs_users")
      .select("*")
      .limit(5);

    if (error) {
      return res.status(500).json({ message: "Supabase error", details: error.message });
    }
    return res.json(data ?? []);
  });

  app.get("/api/debug/env", (_req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL ? "set ✅" : "missing ❌",
      serviceRole: process.env.SUPABASE_SERVICE_ROLE ? "set ✅" : "missing ❌",
      dbUrl: process.env.DATABASE_URL ? "set ✅" : "missing ❌",
      storageBucket: process.env.STORAGE_BUCKET || "not set",
    });
  });


  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
