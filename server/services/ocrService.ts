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
    try {
      // For scanned PDFs, try to extract as much text as possible
      // If this fails, suggest user to upload as image instead
      
      // Convert buffer to base64 and try OCR on the PDF data
      // This is a simplified approach - ideally we'd convert PDF pages to images first
      const base64 = buffer.toString('base64');
      const dataURL = `data:application/pdf;base64,${base64}`;
      
      // Attempt basic OCR recognition
      const { data: { text } } = await Tesseract.recognize(
        dataURL,
        'eng',
        {
          logger: () => {} // Silent logging for PDF attempts
        }
      );
      
      if (!text || text.trim().length < 10) {
        throw new Error('PDF appears to be scanned but contains minimal extractable text. Please try uploading as PNG or JPG for better OCR results.');
      }
      
      return text;
    } catch (error) {
      // Provide helpful error message for users
      throw new Error(`This PDF appears to be scanned and cannot be processed automatically. Please try: 1) Converting the PDF to PNG/JPG images, or 2) Using a PDF with selectable text. Error: ${getErrorMessage(error)}`);
    }
  }

  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isPDFFile(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }
}
