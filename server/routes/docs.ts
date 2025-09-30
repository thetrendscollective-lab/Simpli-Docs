import { Router } from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from "mammoth";

const upload = multer({ dest: "uploads/", limits: { fileSize: 50 * 1024 * 1024 } });
const router = Router();

async function extractText(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  try {
    if (ext === ".pdf") {
      const buf = await fs.readFile(filePath);
      const uint8Array = new Uint8Array(buf);
      const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      let text = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n';
      }
      return text || "";
    } else if (ext === ".docx") {
      const { value } = await mammoth.extractRawText({ path: filePath });
      return value || "";
    } else {
      return await fs.readFile(filePath, "utf8");
    }
  } catch (err) {
    console.error("EXTRACT_TEXT_ERROR", err);
    return "";
  }
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log(`Processing file: ${req.file.originalname}, type: ${req.file.mimetype}, size: ${req.file.size} bytes`);
    const text = await extractText(req.file.path, req.file.originalname);
    await fs.unlink(req.file.path).catch(() => {});
    
    console.log(`Extracted text length: ${text?.length || 0} characters`);
    if (text && text.trim()) {
      console.log(`First 100 chars: ${text.slice(0, 100)}`);
    }
    
    if (!text || !text.trim()) {
      return res.json({
        summary: "No readable text found in the document.",
        keyPoints: [],
        glossary: [],
        actionItems: []
      });
    }

    // Generate simple summary and key points from extracted text
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const summary = text.length > 500 ? text.slice(0, 500) + '...' : text;
    const keyPoints = lines.slice(0, 5).map(line => line.trim());
    
    // Extract potential terms (words that appear capitalized frequently)
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

    return res.json({ summary, keyPoints, glossary, actionItems });
  } catch (err: any) {
    console.error("UPLOAD_ROUTE_ERROR", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

export default router;
