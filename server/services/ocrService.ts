import Tesseract from 'tesseract.js';
import { getErrorMessage } from "../utils";

export class OCRService {
  async extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      // Convert buffer to base64 data URL
      const base64 = buffer.toString('base64');
      const dataURL = `data:${mimeType};base64,${base64}`;

      const { data: { text } } = await Tesseract.recognize(
        dataURL,
        'eng',
        {
          logger: m => console.log(m) // Optional logging
        }
      );

      return text;
    } catch (error) {
      throw new Error(`Failed to extract text from image: ${getErrorMessage(error)}`);
    }
  }

  async extractTextFromScannedPDF(buffer: Buffer): Promise<string> {
    // For PDFs that might be scanned images, we would need to convert
    // PDF pages to images first, then OCR each page
    // This is a placeholder implementation for now
    try {
      // TODO: Implement PDF to image conversion using pdf2pic or similar
      // For now, return a message indicating OCR is not available for PDFs
      throw new Error('OCR for scanned PDFs requires additional setup. Please ensure the PDF contains extractable text or try uploading as an image (PNG/JPG).');
    } catch (error) {
      throw new Error(`Failed to extract text from scanned PDF: ${getErrorMessage(error)}`);
    }
  }

  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isPDFFile(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }
}
