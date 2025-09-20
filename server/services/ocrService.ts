import Tesseract from 'tesseract.js';

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
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }

  async extractTextFromScannedPDF(buffer: Buffer): Promise<string> {
    // For PDFs that might be scanned images, we would need to convert
    // PDF pages to images first, then OCR each page
    // This is a simplified implementation
    try {
      // In a real implementation, you'd use pdf2pic or similar
      // to convert PDF pages to images, then OCR each image
      return await this.extractTextFromImage(buffer, 'application/pdf');
    } catch (error) {
      throw new Error(`Failed to extract text from scanned PDF: ${error.message}`);
    }
  }

  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isPDFFile(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }
}
