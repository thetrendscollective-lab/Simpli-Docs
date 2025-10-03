import express, { type Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { setupVite, serveStatic, log } from "./vite";
import { supabase } from "./services/supa";
import { uploadInit, uploadComplete } from "./routes/upload";
import { getDoc, getDocText, getLatestDocId } from "./routes/read";
import { postExplain, getExplanation } from "./routes/explain";
import docsRouter from "./routes/docs";
import apiRouter from "./routes/api";
import stripeRouter from "./routes/stripe";
import Stripe from "stripe";
import { storage } from "./storage";
import { OpenAIService } from "./services/openai";
import { DocumentProcessor } from "./services/documentProcessor";
import { insertQASchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { getErrorMessage } from "./utils";
import { setupAuth, isAuthenticated } from "./replitAuth";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const openaiService = new OpenAIService();
const documentProcessor = new DocumentProcessor();

const app = express();

// CRITICAL: Stripe webhook MUST come before express.json to preserve raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        
        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price.id;
          
          // Determine plan tier from price ID
          let planTier = 'free';
          if (priceId === process.env.PRICE_STANDARD || priceId === 'price_1SDDKUClhBp5wD3K7bEUJPzu') {
            planTier = 'standard';
          } else if (priceId === process.env.PRICE_PRO || priceId === 'price_1SDDL0ClhBp5wD3KCrHPkJbi') {
            planTier = 'pro';
          } else if (priceId === process.env.PRICE_FAMILY || priceId === 'price_1SDDLsClhBp5wD3KAdRBKaSm') {
            planTier = 'family';
          }

          // Update user with subscription details
          await storage.upsertUser({
            id: userId,
            stripeCustomerId: session.customer as string,
            subscriptionStatus: subscription.status,
            currentPlan: planTier,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          });

          console.log(`Subscription linked to user ${userId}: ${planTier}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        console.log(`Subscription updated for customer ${subscription.customer}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        console.log(`Subscription deleted for customer ${subscription.customer}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Error processing webhook:', err);
    res.status(500).send(`Webhook processing error: ${err.message}`);
  }
});

// Now apply JSON parser for all other routes
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
  // Setup Replit Auth (must be before routes)
  await setupAuth(app);

  // Auth route
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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

  // Stripe routes
  app.use("/api/stripe", stripeRouter);

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
      const { tier } = req.body;
      
      console.log('Checkout session request:', { tier });
      console.log('Environment variables:', {
        PRICE_STANDARD: process.env.PRICE_STANDARD ? 'set' : 'NOT SET',
        PRICE_PRO: process.env.PRICE_PRO ? 'set' : 'NOT SET',
        PRICE_FAMILY: process.env.PRICE_FAMILY ? 'set' : 'NOT SET'
      });
      
      if (!tier) {
        return res.status(400).json({ error: "Tier is required" });
      }

      // Map tier to environment variable price ID
      let priceId: string | undefined;
      switch (tier.toLowerCase()) {
        case 'standard':
          priceId = process.env.PRICE_STANDARD;
          break;
        case 'pro':
          priceId = process.env.PRICE_PRO;
          break;
        case 'family':
          priceId = process.env.PRICE_FAMILY;
          break;
        default:
          return res.status(400).json({ error: "Invalid tier. Must be standard, pro, or family" });
      }

      console.log('Selected price ID for tier', tier, ':', priceId ? 'found' : 'NOT FOUND');

      if (!priceId) {
        return res.status(500).json({ error: `Price ID not configured for ${tier} tier. Please set PRICE_${tier.toUpperCase()} environment variable.` });
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

  app.post("/api/documents/:id/regenerate", async (req, res) => {
    try {
      const { id } = req.params;
      const { readingLevel = 'standard', language = 'en' } = req.body;
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

      if (!document.originalText) {
        return res.status(400).json({ error: "No text available for processing" });
      }

      // Validate reading level
      const level: 'simple' | 'standard' | 'detailed' = 
        ['simple', 'standard', 'detailed'].includes(readingLevel) 
          ? readingLevel as 'simple' | 'standard' | 'detailed'
          : 'standard';

      // Generate guidance based on reading level
      const guidance =
        level === 'simple'
          ? `Write for a typical 5th grader. Use very short sentences (average 8-12 words). Replace all legal or financial jargon with everyday words. Avoid complex numbers. Add tiny examples where helpful. Keep vocabulary basic and concrete.`
          : level === 'detailed'
          ? `Write for a professional adult with domain expertise. Use longer, compound sentences (average 18-25 words). Include technical terminology with precise clarifications. Provide comprehensive context, relevant nuances, and important caveats. Be thorough and detailed rather than brief.`
          : `Write for a general reader (8th–10th grade). Use moderate sentences (12-16 words average). Use clear, plain language and avoid unnecessary jargon. Be concise but informative.`;

      const systemPrompt = `You extract structured outputs from documents.
Return strict JSON with this shape:
{
  "summary": "120-200 words executive summary at the specified reading level",
  "keyPoints": ["3-7 concise bullets"],
  "glossary": [{"term":"...","definition":"..."}],
  "actionItems": ["actionable next steps"],
  "readingLevelUsed": "${level}"
}

CRITICAL READING LEVEL REQUIREMENTS:
${guidance}

Additional rules:
- For summary: STRICTLY follow the reading level guidance above regarding sentence length and vocabulary complexity.
- For keyPoints: Keep bullets under ~20 words but adjust complexity to match reading level.
- For glossary: Adjust definition complexity to match reading level.
- For actionItems: Be specific and actionable, with vocabulary appropriate to reading level.

Format your response as JSON with these exact keys: summary (string), keyPoints (array of strings), glossary (array of {term, definition}), actionItems (array of strings), readingLevelUsed (string).`;

      const userMessage = `Document text:\n\n${document.originalText.substring(0, 12000)}`;

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const chat = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const rawResponse = chat.choices[0]?.message?.content ?? '{}';
      let parsed;
      try {
        parsed = JSON.parse(rawResponse);
      } catch (e) {
        console.error('Failed to parse OpenAI response:', e);
        parsed = { summary: rawResponse, keyPoints: [], glossary: [], actionItems: [], readingLevelUsed: level };
      }

      // Simplify glossary for "simple" reading level
      if (parsed.glossary && level === 'simple') {
        parsed.glossary = parsed.glossary.map((g: any) => ({
          term: g.term,
          definition: String(g.definition)
            .replace(/\b(income)\b/gi, 'money you earn')
            .replace(/\b(liabilities)\b/gi, 'debts you owe')
            .replace(/\b(assets)\b/gi, 'things you own that have value')
            .replace(/\b(exemptions?)\b/gi, 'special deductions that lower taxable income')
            .replace(/\b(perjury)\b/gi, 'lying under oath (a crime)')
            .replace(/\b(deductions?)\b/gi, 'amounts subtracted from income')
            .replace(/\b(petitioner)\b/gi, 'person who files the request')
            .replace(/\b(respondent)\b/gi, 'person who responds to the request')
        }));
      }

      const result = {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || parsed.key_points || [],
        glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
        actionItems: parsed.actionItems || parsed.action_items || [],
        readingLevelUsed: parsed.readingLevelUsed || level,
      };

      res.json(result);

    } catch (error) {
      console.error("Error regenerating document:", error);
      res.status(500).json({ 
        error: getErrorMessage(error) || "Failed to regenerate document" 
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
