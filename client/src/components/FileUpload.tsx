import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  sessionId: string;
  language: string;
  onUploadStart: () => void;
  onProcessingStart: () => void;
  onUploadComplete: (documentId: string) => void;
}

export default function FileUpload({ 
  sessionId, 
  language, 
  onUploadStart, 
  onProcessingStart, 
  onUploadComplete 
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "Session not ready. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, TXT, PNG, or JPG file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }

    onUploadStart();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('language', language);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      onProcessingStart();

      // Simulate processing delay for better UX
      setTimeout(() => {
        onUploadComplete(result.documentId);
        toast({
          title: "Document processed successfully",
          description: `${result.filename} has been analyzed and is ready for review.`,
        });
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive"
      });
      onUploadComplete(""); // Reset to idle state
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="mb-8">
      <div 
        className={`upload-zone border-2 border-dashed rounded-lg p-12 text-center bg-card hover:bg-muted/30 transition-colors cursor-pointer ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        data-testid="upload-zone"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <i className="fas fa-cloud-upload-alt text-2xl text-primary"></i>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Upload a legal or medical document to begin
            </h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop your file here, or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports: PDF, DOCX, TXT, PNG, JPG (up to 10MB)
            </p>
          </div>
          <button 
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors font-medium"
            data-testid="button-choose-file"
          >
            Choose File
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          onChange={handleFileInputChange}
          data-testid="input-file"
        />
      </div>
    </div>
  );
}
