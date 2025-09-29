import { useState, useEffect } from "react";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import Header from "@/components/Header";
import FileUpload from "@/components/FileUpload";
import ProcessingState from "@/components/ProcessingState";
import DocumentDashboard from "@/components/DocumentDashboard";
import { Shield, Lock, Globe } from "lucide-react";

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
    // Only navigate if we have a valid document ID
    if (!documentId || documentId.trim() === "") {
      // No document ID means upload failed - reset to idle state
      setProcessingState("idle");
      return;
    }
    
    // Store session ID for results page
    localStorage.setItem('sessionId', sessionId);
    // Redirect to results page with valid document ID
    window.location.href = `/doc/${documentId}`;
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
        {/* Privacy & Security Banner - More Prominent */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-center space-x-3 mb-3">
            <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">🔒 Your Privacy is Protected</h3>
          </div>
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Auto-Delete:</strong> Your documents are processed securely and automatically deleted after your session ends.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Zero Storage:</strong> We do not store your files, personal information, or document content. Everything is processed in real-time and discarded.
            </p>
          </div>
          <div className="flex justify-center space-x-6 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Lock className="h-3 w-3" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center space-x-1">
              <Shield className="h-3 w-3" />
              <span>HIPAA Secure</span>
            </div>
            <div className="flex items-center space-x-1">
              <Globe className="h-3 w-3" />
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>

        {processingState === "idle" && (
          <FileUpload
            sessionId={sessionId}
            language={language}
            onUploadStart={() => setProcessingState("uploading")}
            onProcessingStart={() => setProcessingState("processing")}
            onUploadComplete={handleFileUploaded}
            onError={() => setProcessingState("idle")}
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
            sessionId={sessionId}
            onDelete={handleDeleteDocument}
            data-testid="document-dashboard"
          />
        )}
      </main>

      <footer className="bg-card border-t border-border mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Simpli-Docs © 2024 - Made for understanding complex documents - A Trends Collective Company
          </p>
        </div>
      </footer>
    </div>
  );
}
