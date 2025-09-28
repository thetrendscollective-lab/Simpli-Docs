import type { Request, Response } from "express";
import multer from "multer";
import { storage } from "../storage";
import { DocumentProcessor } from "../services/documentProcessor";
import { OCRService } from "../services/ocrService";
import { insertDocumentSchema } from "@shared/schema";
import { calculateDocumentPrice } from "@shared/pricing";
import { randomUUID } from "crypto";
import { getErrorMessage } from "../utils";

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

const documentProcessor = new DocumentProcessor();
const ocrService = new OCRService();

export const uploadInit = async (req: Request, res: Response) => {
  try {
    const sessionId = randomUUID();
    res.json({ sessionId });
  } catch (error) {
    console.error("Error creating upload session:", error);
    res.status(500).json({ error: "Failed to create upload session" });
  }
};

export const uploadComplete = [upload.single('file'), async (req: Request, res: Response) => {
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
}];