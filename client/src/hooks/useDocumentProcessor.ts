import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";

export function useDocumentProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processFile = async (file: File, sessionId: string, language: string = 'en') => {
    setIsProcessing(true);
    
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
      
      toast({
        title: "Document processed successfully",
        description: `${result.filename} has been analyzed and is ready for review.`,
      });

      return result;
    } catch (error) {
      toast({
        title: "Processing failed",
        description: getErrorMessage(error) || "Failed to process document. Please try again.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processFile,
    isProcessing
  };
}
