import { useState, useEffect } from "react";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import Header from "@/components/Header";
import FileUpload from "@/components/FileUpload";
import ProcessingState from "@/components/ProcessingState";
import DocumentDashboard from "@/components/DocumentDashboard";

export default function Home() {
  const [sessionId, setSessionId] = useState<string>("");
  const [currentDocumentId, setCurrentDocumentId] = useState<string>("");
  const [processingState, setProcessingState] = useState<"idle" | "uploading" | "processing" | "complete">("idle");
  const [language, setLanguage] = useState("en");

  // Generate session ID on mount
  useEffect(() => {
    fetch("/api/session", { method: "POST" })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId))
      .catch(console.error);
  }, []);

  const handleFileUploaded = (documentId: string) => {
    setCurrentDocumentId(documentId);
    setProcessingState("complete");
  };

  const handleDeleteDocument = () => {
    setCurrentDocumentId("");
    setProcessingState("idle");
  };

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        fetch(`/api/sessions/${sessionId}`, { method: "DELETE" })
          .catch(console.error);
      }
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DisclaimerBanner />
      <Header language={language} onLanguageChange={setLanguage} />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {processingState === "idle" && (
          <FileUpload
            sessionId={sessionId}
            language={language}
            onUploadStart={() => setProcessingState("uploading")}
            onProcessingStart={() => setProcessingState("processing")}
            onUploadComplete={handleFileUploaded}
            data-testid="file-upload-section"
          />
        )}

        {(processingState === "uploading" || processingState === "processing") && (
          <ProcessingState 
            state={processingState}
            data-testid="processing-section"
          />
        )}

        {processingState === "complete" && currentDocumentId && (
          <DocumentDashboard
            documentId={currentDocumentId}
            language={language}
            onDelete={handleDeleteDocument}
            data-testid="document-dashboard"
          />
        )}
      </main>

      <footer className="bg-card border-t border-border mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <i className="fas fa-shield-alt text-warning"></i>
              <span className="font-semibold text-foreground">Privacy & Security</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your documents are processed securely and deleted automatically after your session ends. 
              We do not store your files or personal information.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Plain-Language Doc Explainer © 2024 - Made for understanding complex documents - A Trends Collective Company
          </p>
        </div>
      </footer>
    </div>
  );
}
