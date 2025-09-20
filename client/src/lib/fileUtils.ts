export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(file: File): { isValid: boolean; error?: string } {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a PDF, DOCX, TXT, PNG, or JPG file.'
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: 'File too large. Please upload a file smaller than 10MB.'
    };
  }

  return { isValid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'fas fa-file-pdf text-destructive';
  if (mimeType.includes('word')) return 'fas fa-file-word text-primary';
  if (mimeType.includes('text')) return 'fas fa-file-alt text-muted-foreground';
  if (mimeType.includes('image')) return 'fas fa-file-image text-green-500';
  return 'fas fa-file text-muted-foreground';
}

export function extractTextFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    // This would be used for client-side OCR if needed
    // For now, we're using server-side OCR
    resolve('');
  });
}
