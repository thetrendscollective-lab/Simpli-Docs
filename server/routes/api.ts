import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import { DocumentProcessor } from "../services/documentProcessor";
import { OCRService } from "../services/ocrService";
import { storage } from "../storage";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const documentProcessor = new DocumentProcessor();
const ocrService = new OCRService();

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

    // Get language parameter (default to English)
    const language = req.body.language || 'en';

    console.log(`Processing file: ${fileName}, type: ${mime}, size: ${req.file.size} bytes, level: ${level}, language: ${language}`);

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

    const result = {
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || parsed.key_points || [],
      glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
      actionItems: parsed.actionItems || parsed.action_items || [],
      readingLevelUsed: parsed.readingLevelUsed || level,
      raw: rawResponse
    };

    // Increment usage count after successful processing
    await storage.incrementUsage(clientIP);
    const updatedUsage = await storage.checkUsageLimit(clientIP, MONTHLY_FREE_LIMIT);
    
    console.log('Processing complete, sending response with', result.keyPoints.length, 'key points at', level, 'level');
    console.log(`Usage: ${MONTHLY_FREE_LIMIT - updatedUsage.remaining}/${MONTHLY_FREE_LIMIT}, Remaining: ${updatedUsage.remaining}`);
    
    res.json({
      ...result,
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

export default router;
