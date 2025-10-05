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
import eobRouter from "./routes/eob";
import calendarRouter from "./routes/calendar";
import Stripe from "stripe";
import { storage } from "./storage";
import { OpenAIService } from "./services/openai";
import { DocumentProcessor } from "./services/documentProcessor";
import { insertQASchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { getErrorMessage } from "./utils";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { authenticateSupabase, AuthUser } from "./middleware/supabaseAuth";
import { getStripe } from "./stripe";

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
    const stripe = getStripe();
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
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price.id;
          
          // Determine plan tier from price ID (handle both test and production)
          let planTier = 'free';
          if (priceId === process.env.PRICE_STANDARD || priceId === process.env.TESTING_PRICE_STANDARD) {
            planTier = 'standard';
          } else if (priceId === process.env.PRICE_PRO || priceId === process.env.TESTING_PRICE_PRO) {
            planTier = 'pro';
          } else if (priceId === process.env.PRICE_FAMILY || priceId === process.env.TESTING_PRICE_FAMILY) {
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
  // Supabase config endpoint (MUST be before Replit Auth and Vite middleware)
  app.get('/api/config', (req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    });
  });

  // Setup Replit Auth (must be before routes)
  await setupAuth(app);

  // Auth route - using Supabase authentication
  app.get('/api/auth/user', authenticateSupabase, async (req: any, res) => {
    try {
      const authUser = req.user as AuthUser;
      if (!authUser) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const user = await storage.getUser(authUser.id);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Mount the route handlers as specified - all with optional auth for Supabase support
  app.post("/api/upload/init", authenticateSupabase, uploadInit);
  app.post("/api/upload/complete", authenticateSupabase, uploadComplete);
  app.get("/api/docs/:id", authenticateSupabase, getDoc);
  app.get("/api/docs/:id/text", authenticateSupabase, getDocText);
  app.post("/api/explain", authenticateSupabase, postExplain);
  app.get("/api/explanations/:document_id", authenticateSupabase, getExplanation);
  app.get("/api/docs/latest-id", authenticateSupabase, getLatestDocId);

  // Compatibility route for frontend - maps old endpoint to new handler
  app.post("/api/documents/upload", authenticateSupabase, uploadComplete);

  // Simplified docs upload route - requires authentication
  app.use("/api/docs", authenticateSupabase, docsRouter);

  // Stripe routes (MUST come before /api middleware to allow public /prices endpoint)
  app.use("/api/stripe", stripeRouter);

  // EMERGENCY FIX: Manual subscription activation (development only)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/emergency-activate-subscription", async (req, res) => {
      try {
        const { userId, plan } = req.body;
        
        if (!userId || !plan) {
          return res.status(400).json({ error: 'userId and plan are required' });
        }
        
        const validPlans = ['free', 'standard', 'pro', 'family'];
        if (!validPlans.includes(plan)) {
          return res.status(400).json({ error: 'Invalid plan' });
        }
        
        await storage.upsertUser({
          id: userId,
          currentPlan: plan as 'free' | 'standard' | 'pro' | 'family',
          subscriptionStatus: 'active'
        });
        
        console.log(`✅ EMERGENCY: Activated ${plan} subscription for user ${userId}`);
        
        res.json({ success: true, message: `${plan} subscription activated` });
      } catch (e: any) {
        console.error('Emergency activation error:', e);
        res.status(500).json({ error: e.message });
      }
    });
  }

  // EOB-specific routes - require authentication
  app.use("/api/eob", authenticateSupabase, eobRouter);

  // Calendar routes - require authentication
  app.use("/api/calendar", authenticateSupabase, calendarRouter);

  // Main processing route (consolidated) - requires authentication
  app.use("/api", authenticateSupabase, apiRouter);

  // Session management - require authentication
  app.post("/api/session", authenticateSupabase, async (req, res) => {
    try {
      const authUser = (req as any).user as AuthUser;
      const sessionId = authUser.id; // Use user ID as session ID for authenticated users
      res.json({ sessionId });
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Note: Stripe subscription checkout is handled by /api/stripe/create-checkout-session
  // in the stripeRouter (see server/routes/stripe.ts) with proper authentication

  // Document processing routes - Require authentication
  app.post("/api/documents/:id/summarize", authenticateSupabase, async (req, res) => {
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

  app.post("/api/documents/:id/regenerate", authenticateSupabase, async (req, res) => {
    try {
      const { id } = req.params;
      const { readingLevel = 'standard' } = req.body;
      let { language = 'en' } = req.body;
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

      // Enforce language restriction: only paid users can use non-English languages
      const authUser = (req as any).user as AuthUser;
      let currentPlan = 'free';
      
      if (authUser) {
        // Get current plan from authenticated user
        currentPlan = authUser.currentPlan || 'free';
      }
      
      // Only Standard, Pro, and Family plans can use non-English languages
      // Unauthenticated users and free users are restricted to English
      if (currentPlan === 'free' && language !== 'en') {
        console.log(`User with plan '${currentPlan}' attempted to regenerate with language ${language}, forcing to English`);
        language = 'en';
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

      // Get language name for the prompt
      const languageNames: { [key: string]: string } = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'zh-CN': 'Simplified Chinese',
        'zh-TW': 'Traditional Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'pa': 'Punjabi',
        'ur': 'Urdu',
        'bn': 'Bengali',
        'tr': 'Turkish',
        'vi': 'Vietnamese',
        'th': 'Thai',
        'fil': 'Filipino',
        'sw': 'Swahili'
      };
      const languageName = languageNames[language] || 'English';

      const systemPrompt = `You extract structured outputs from documents.
Return strict JSON with this shape:
{
  "summary": "120-200 words executive summary at the specified reading level",
  "keyPoints": ["3-7 concise bullets"],
  "glossary": [{"term":"...","definition":"..."}],
  "actionItems": ["actionable next steps"],
  "readingLevelUsed": "${level}"
}

CRITICAL OUTPUT LANGUAGE REQUIREMENT:
- ALL output (summary, keyPoints, glossary definitions, actionItems) MUST be in ${languageName}.
- Technical terms in glossary can remain in their original language, but definitions must be in ${languageName}.
- Maintain natural, idiomatic phrasing appropriate for native speakers of ${languageName}.

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

  app.post("/api/documents/:id/glossary", authenticateSupabase, async (req, res) => {
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

  app.post("/api/documents/:id/ask", authenticateSupabase, async (req, res) => {
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
        citations: result.citations,
        confidence: Math.round(result.confidence * 100)
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

  app.get("/api/documents/:id/qa", authenticateSupabase, async (req, res) => {
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

  app.delete("/api/documents/:id", authenticateSupabase, async (req, res) => {
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

  // Session cleanup - no auth required (sessionId-based access control)
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

  // Payment routes - Optional auth (sessionId-based access)
  app.post("/api/create-payment-intent", authenticateSupabase, async (req, res) => {
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

      const stripe = getStripe();
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

  app.post("/api/documents/:documentId/verify-payment", authenticateSupabase, async (req, res) => {
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

      const stripe = getStripe();
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
