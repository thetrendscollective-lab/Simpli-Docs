import { ProcessedSection, GlossaryTerm } from "@shared/schema";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

export class DocumentProcessor {
  async extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
      const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pageCount = pdfDoc.numPages;
      let text = '';

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        text += `\n--- Page ${i} ---\n${pageText}`;
      }

      return { text, pageCount };
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  extractTextFromTXT(buffer: Buffer): string {
    return buffer.toString('utf-8');
  }

  parseDocumentSections(text: string): ProcessedSection[] {
    const sections: ProcessedSection[] = [];
    const lines = text.split('\n');
    let currentSection: ProcessedSection | null = null;
    let currentPageNumber = 1;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for page markers
      const pageMatch = trimmedLine.match(/--- Page (\d+) ---/);
      if (pageMatch) {
        currentPageNumber = parseInt(pageMatch[1]);
        continue;
      }

      // Skip empty lines
      if (!trimmedLine) continue;

      // Check if this looks like a heading (all caps, short, or starts with numbers/letters)
      const isHeading = this.isLikelyHeading(trimmedLine);

      if (isHeading) {
        // Save previous section if exists
        if (currentSection && currentSection.content.trim()) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          id: `section_${sections.length + 1}`,
          title: trimmedLine,
          content: '',
          pageNumbers: [currentPageNumber],
          type: 'heading'
        };
      } else if (currentSection) {
        // Add content to current section
        currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
        if (!currentSection.pageNumbers.includes(currentPageNumber)) {
          currentSection.pageNumbers.push(currentPageNumber);
        }
      } else {
        // Create a default section if no heading found yet
        currentSection = {
          id: `section_${sections.length + 1}`,
          title: 'Document Content',
          content: trimmedLine,
          pageNumbers: [currentPageNumber],
          type: 'paragraph'
        };
      }
    }

    // Add final section
    if (currentSection && currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  private isLikelyHeading(text: string): boolean {
    // Check various heading patterns
    const patterns = [
      /^[A-Z\s]+$/, // All caps
      /^\d+[\.\)]\s/, // Numbered list
      /^[A-Z][A-Z\s]*:/, // Starts with caps and ends with colon
      /^[IVX]+[\.\)]\s/, // Roman numerals
      /^[A-Z][a-z]+\s[A-Z]/, // Title case
    ];

    const isShort = text.length < 100;
    const matchesPattern = patterns.some(pattern => pattern.test(text));
    
    return isShort && matchesPattern;
  }

  createDocumentChunks(sections: ProcessedSection[]): Array<{
    id: string;
    content: string;
    pageNumber: number;
  }> {
    const chunks: Array<{ id: string; content: string; pageNumber: number }> = [];

    for (const section of sections) {
      // Split large sections into smaller chunks
      const words = section.content.split(' ');
      const chunkSize = 500; // words per chunk
      
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkWords = words.slice(i, i + chunkSize);
        const chunkContent = chunkWords.join(' ');
        
        chunks.push({
          id: `${section.id}_chunk_${Math.floor(i / chunkSize)}`,
          content: `${section.title}\n\n${chunkContent}`,
          pageNumber: section.pageNumbers[0] || 1
        });
      }
    }

    return chunks;
  }

  detectDocumentType(text: string): 'legal' | 'medical' {
    const legalKeywords = [
      'contract', 'agreement', 'clause', 'party', 'parties', 'whereas',
      'liability', 'indemnify', 'breach', 'terminate', 'jurisdiction',
      'arbitration', 'damages', 'warranty', 'representation'
    ];

    const medicalKeywords = [
      'patient', 'diagnosis', 'treatment', 'medication', 'dosage',
      'symptoms', 'blood', 'pressure', 'glucose', 'cholesterol',
      'mg/dl', 'mmhg', 'procedure', 'examination', 'test results'
    ];

    const lowerText = text.toLowerCase();
    const legalCount = legalKeywords.filter(keyword => lowerText.includes(keyword)).length;
    const medicalCount = medicalKeywords.filter(keyword => lowerText.includes(keyword)).length;

    return medicalCount > legalCount ? 'medical' : 'legal';
  }
}
