import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import { DocumentProcessor } from "../services/documentProcessor";
import { OCRService } from "../services/ocrService";
import { LanguageDetectionService } from "../services/languageDetectionService";
import { EOBDetectionService } from "../services/eobDetectionService";
import { EOBExtractionService } from "../services/eobExtractionService";
import { storage } from "../storage";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const documentProcessor = new DocumentProcessor();
const ocrService = new OCRService();
const languageDetectionService = new LanguageDetectionService(process.env.OPENAI_API_KEY || '');
const eobDetectionService = new EOBDetectionService();
const eobExtractionService = new EOBExtractionService();

const MONTHLY_FREE_LIMIT = 2; // 2 documents per month for free users

// Helper function to get client IP address
function getClientIP(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

router.post('/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check usage limits
    const clientIP = getClientIP(req);
    console.log(`Request from IP: ${clientIP}`);
    
    const usageCheck = await storage.checkUsageLimit(clientIP, MONTHLY_FREE_LIMIT);
    
    if (!usageCheck.allowed) {
      return res.status(429).json({ 
        error: 'Monthly limit reached',
        message: `You've reached your free limit of ${MONTHLY_FREE_LIMIT} documents per month. Please upgrade to continue.`,
        remaining: 0,
        limit: MONTHLY_FREE_LIMIT
      });
    }

    const buf = req.file.buffer;
    const mime = req.file.mimetype.toLowerCase();
    const fileName = req.file.originalname;
    
    // Validate and sanitize reading level input
    const rawLevel = req.body.level || 'standard';
    const level: 'simple' | 'standard' | 'detailed' = 
      ['simple', 'standard', 'detailed'].includes(rawLevel) 
        ? rawLevel as 'simple' | 'standard' | 'detailed'
        : 'standard';

    console.log(`Processing file: ${fileName}, type: ${mime}, size: ${req.file.size} bytes, level: ${level}`);

    let text = '';

    // Extract text based on file type
    if (mime.includes('pdf')) {
      console.log('Extracting PDF text...');
      const result = await documentProcessor.extractTextFromPDF(buf);
      text = result.text || '';
      console.log(`PDF extraction complete: ${text.length} characters`);
    } else if (mime.includes('word') || mime.includes('docx') || mime.includes('document')) {
      console.log('Extracting DOCX text...');
      text = await documentProcessor.extractTextFromDOCX(buf);
      console.log(`DOCX extraction complete: ${text.length} characters`);
    } else if (mime.startsWith('image/')) {
      console.log('Running OCR on image...');
      text = await ocrService.extractTextFromImage(buf, mime);
      console.log(`OCR complete: ${text.length} characters`);
    } else if (mime.includes('plain') || mime.includes('text')) {
      console.log('Reading plain text...');
      text = documentProcessor.extractTextFromTXT(buf);
      console.log(`Text file read: ${text.length} characters`);
    } else {
      return res.status(415).json({ error: `Unsupported file type: ${mime}` });
    }

    if (!text.trim()) {
      return res.status(422).json({ error: 'Could not extract text from document' });
    }

    console.log(`Text extracted successfully. First 100 chars: ${text.slice(0, 100)}`);

    // Detect document language automatically
    let detectedLanguage = 'en';
    let confidence = 50;
    let detectedLanguageName = 'English';
    
    if (process.env.OPENAI_API_KEY && text.length > 50) {
      console.log('Detecting document language...');
      const detection = await languageDetectionService.detectLanguage(text);
      detectedLanguage = detection.language;
      confidence = detection.confidence;
      detectedLanguageName = detection.languageName;
      console.log(`Language detected: ${detectedLanguageName} (${confidence}% confidence)`);
    }

    // Determine output language based on user input, detection, and subscription
    const authUser = (req as any).user as any;
    const isAuthenticated = !!authUser;
    let currentPlan = 'free';
    let userId: string | null = null;
    
    if (isAuthenticated && authUser.id) {
      // Supabase auth
      userId = authUser.id;
      currentPlan = authUser.currentPlan || 'free';
    } else if (isAuthenticated && authUser.claims?.sub) {
      // Replit auth (legacy fallback)
      userId = authUser.claims.sub;
      if (userId) {
        const user = await storage.getUser(userId);
        currentPlan = user?.currentPlan || 'free';
      }
    }

    // Language selection priority:
    // 1. If user manually selected a language (req.body.language), use it (for paid users)
    // 2. Otherwise, use detected language (for paid users)
    // 3. Free users always get English regardless of detection or selection
    let outputLanguage = req.body.language || detectedLanguage;
    
    // Enforce subscription tier restrictions
    if (currentPlan === 'free' && outputLanguage !== 'en') {
      console.log(`User with plan '${currentPlan}' attempted to use language ${outputLanguage}, forcing to English`);
      outputLanguage = 'en';
    }

    console.log(`Output language: ${outputLanguage}, Detected: ${detectedLanguage} (${confidence}% confidence)`);

    // EOB Detection and Extraction for Pro/Family users ONLY
    let eobData = null;
    let documentType = 'general';
    
    // Enforce Pro/Family plan requirement for EOB analysis
    if (isAuthenticated && (currentPlan === 'pro' || currentPlan === 'family')) {
      console.log('User has Pro/Family plan, checking if document is an EOB...');
      const eobDetection = eobDetectionService.detectEOB(text);
      
      if (eobDetection.isEOB) {
        console.log(`EOB detected with ${eobDetection.confidence}% confidence: ${eobDetection.reason}`);
        documentType = 'eob';
        
        try {
          console.log('Extracting structured EOB data...');
          eobData = await eobExtractionService.extractEOBData(text);
          console.log(`EOB extraction complete. Found ${eobData.lineItems.length} line items, total patient responsibility: $${eobData.financialSummary.totalPatientResponsibility}`);
        } catch (error) {
          console.error('Failed to extract EOB data:', error);
        }
      } else {
        console.log(`Document is not an EOB (${eobDetection.confidence}% confidence)`);
      }
    } else if (!isAuthenticated) {
      console.log('User not authenticated, skipping EOB detection');
    } else {
      console.log(`User plan '${currentPlan}' does not have EOB analyzer access (Pro/Family only)`);
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('No OpenAI API key, using simple extraction...');
      // Fallback to simple extraction without AI
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const summary = text.length > 500 ? text.slice(0, 500) + '...' : text;
      const keyPoints = lines.slice(0, 5).map(line => line.trim());
      
      const words = text.match(/\b[A-Z][a-z]+\b/g) || [];
      const wordCounts: { [key: string]: number } = {};
      words.forEach(word => {
        if (word.length > 3) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
      
      const glossary = Object.entries(wordCounts)
        .filter(([_, count]) => count >= 2)
        .slice(0, 5)
        .map(([term]) => ({
          term,
          definition: `Key term appearing in the document`
        }));

      const actionItems = [
        "Review the document thoroughly",
        "Verify all information is accurate",
        "Consult with relevant professionals if needed"
      ];

      // Increment usage for fallback as well
      await storage.incrementUsage(clientIP);
      const updatedUsage = await storage.checkUsageLimit(clientIP, MONTHLY_FREE_LIMIT);

      return res.json({ 
        summary, 
        keyPoints, 
        glossary, 
        actionItems, 
        readingLevelUsed: level, 
        raw: summary,
        usage: {
          remaining: updatedUsage.remaining,
          limit: MONTHLY_FREE_LIMIT
        }
      });
    }

    // Use OpenAI for better processing
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
    const languageName = languageNames[outputLanguage] || 'English';

    const systemPrompt = `You extract structured outputs from documents.
Return strict JSON with this shape:
{
  "summary": "120-200 words executive summary at the specified reading level",
  "keyPoints": ["3-7 concise bullets"],
  "glossary": [{"term":"...","definition":"..."}],
  "actionItems": [{"task":"actionable step","date":"YYYY-MM-DD or null","time":"HH:MM or null"}],
  "readingLevelUsed": "${level}"
}

IMPORTANT: For actionItems, extract any dates/deadlines mentioned in the document. If an action has a specific date mentioned (e.g., "respond by January 15", "payment due March 1"), include it in ISO format (YYYY-MM-DD). If a time is mentioned, include it as HH:MM in 24-hour format. If no date/time is mentioned for an action, use null.

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

    const userMessage = `Document text:\n\n${text.substring(0, 12000)}`;

    console.log('Calling OpenAI API...');
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
    console.log('OpenAI response received');

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
      console.log('Parsed keys:', Object.keys(parsed));
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

    // Normalize action items to always have task, date, and time fields
    const normalizedActionItems = (parsed.actionItems || parsed.action_items || []).map((item: any) => {
      if (typeof item === 'string') {
        return { task: item, date: null, time: null };
      }
      return {
        task: item.task || item,
        date: item.date || null,
        time: item.time || null
      };
    });

    const result = {
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || parsed.key_points || [],
      glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
      actionItems: normalizedActionItems,
      readingLevelUsed: parsed.readingLevelUsed || level,
      raw: rawResponse
    };

    // Increment usage count after successful processing
    await storage.incrementUsage(clientIP);
    const updatedUsage = await storage.checkUsageLimit(clientIP, MONTHLY_FREE_LIMIT);
    
    // Store EOB documents for later retrieval (CSV export, appeal generation)
    // SECURITY: Only store if user is authenticated and has Pro/Family plan
    let documentId: string | undefined;
    if (eobData && documentType === 'eob' && isAuthenticated && userId && (currentPlan === 'pro' || currentPlan === 'family')) {
      try {
        // Use userId as sessionId for secure document ownership tracking
        const storedDoc = await storage.createDocument({
          sessionId: userId, // Store with userId to verify ownership later
          filename: fileName,
          fileType: mime,
          fileSize: req.file.size,
          originalText: text,
          summary: result.summary,
          glossary: result.glossary,
          actionItems: result.actionItems,
          language: outputLanguage,
          detectedLanguage,
          confidence,
          documentType,
          eobData: eobData as any,
          processedSections: null,
          pageCount: 1,
          paymentAmount: null,
          paymentStatus: 'pending',
          stripePaymentIntentId: null
        });
        documentId = storedDoc.id;
        console.log(`EOB document stored with ID: ${documentId} for user: ${userId}`);
      } catch (error) {
        console.error('Failed to store EOB document:', error);
      }
    }
    
    console.log('Processing complete, sending response with', result.keyPoints.length, 'key points at', level, 'level');
    console.log(`Usage: ${MONTHLY_FREE_LIMIT - updatedUsage.remaining}/${MONTHLY_FREE_LIMIT}, Remaining: ${updatedUsage.remaining}`);
    
    res.json({
      ...result,
      detectedLanguage,
      detectedLanguageName,
      confidence,
      outputLanguage,
      documentType,
      eobData,
      documentId,
      usage: {
        remaining: updatedUsage.remaining,
        limit: MONTHLY_FREE_LIMIT
      }
    });

  } catch (e: any) {
    console.error('Processing error:', e);
    res.status(500).json({ error: e.message || 'Processing failed' });
  }
});

// Get usage information for current user
router.get('/usage', async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    const usageCheck = await storage.checkUsageLimit(clientIP, MONTHLY_FREE_LIMIT);
    
    res.json({
      remaining: usageCheck.remaining,
      limit: MONTHLY_FREE_LIMIT,
      used: MONTHLY_FREE_LIMIT - usageCheck.remaining
    });
  } catch (e: any) {
    console.error('Usage check error:', e);
    res.status(500).json({ error: 'Failed to check usage' });
  }
});

// TEST ENDPOINT: Update user plan for testing (development only)
// This endpoint allows test automation to set user plans without going through Stripe
if (process.env.NODE_ENV === 'development') {
  router.post('/test-update-user-plan', async (req, res) => {
    try {
      const { userId, currentPlan } = req.body;
      
      if (!userId || !currentPlan) {
        return res.status(400).json({ error: 'userId and currentPlan are required' });
      }
      
      // Validate plan
      const validPlans = ['free', 'standard', 'pro', 'family'];
      if (!validPlans.includes(currentPlan)) {
        return res.status(400).json({ error: 'Invalid plan. Must be one of: free, standard, pro, family' });
      }
      
      // Upsert user with plan (creates if doesn't exist, updates if exists)
      const user = await storage.upsertUser({
        id: userId,
        email: `test-${userId}@example.com`,
        currentPlan: currentPlan as 'free' | 'standard' | 'pro' | 'family',
        subscriptionStatus: 'active'
      });
      
      console.log(`[TEST] Set user ${userId} plan to ${currentPlan}`);
      
      res.json({ 
        success: true, 
        userId, 
        currentPlan,
        subscriptionStatus: user.subscriptionStatus,
        message: 'User plan updated successfully' 
      });
    } catch (e: any) {
      console.error('[TEST] Update user plan error:', e);
      res.status(500).json({ error: e.message || 'Failed to update user plan' });
    }
  });
  
  console.log('[TEST] Test endpoint /api/test-update-user-plan enabled in development mode');
}

export default router;
