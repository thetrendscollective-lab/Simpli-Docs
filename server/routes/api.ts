import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import { DocumentProcessor } from "../services/documentProcessor";
import { OCRService } from "../services/ocrService";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const documentProcessor = new DocumentProcessor();
const ocrService = new OCRService();

router.post('/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const buf = req.file.buffer;
    const mime = req.file.mimetype.toLowerCase();
    const fileName = req.file.originalname;

    console.log(`Processing file: ${fileName}, type: ${mime}, size: ${req.file.size} bytes`);

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

      return res.json({ summary, keyPoints, glossary, actionItems, raw: summary });
    }

    // Use OpenAI for better processing
    const systemPrompt = `You turn documents into three outputs:
1) SUMMARY: 120-200 word executive summary in plain language.
2) GLOSSARY: 5-12 key technical terms with clear one-line definitions.
3) ACTION ITEMS: bullet list of actionable next steps.

Format your response as JSON with these exact keys: summary, glossary (array of {term, definition}), actionItems (array of strings).`;

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
    } catch (e) {
      console.error('Failed to parse OpenAI response:', e);
      parsed = { summary: rawResponse, glossary: [], actionItems: [] };
    }

    const result = {
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || [],
      glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      raw: rawResponse
    };

    console.log('Processing complete, sending response');
    res.json(result);

  } catch (e: any) {
    console.error('Processing error:', e);
    res.status(500).json({ error: e.message || 'Processing failed' });
  }
});

export default router;
