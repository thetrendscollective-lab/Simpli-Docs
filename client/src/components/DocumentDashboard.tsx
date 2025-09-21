import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { type Document } from "@shared/schema";
import TabNavigation from "@/components/TabNavigation";
import SummaryTab from "@/components/SummaryTab";
import GlossaryTab from "@/components/GlossaryTab";
import OriginalTextTab from "@/components/OriginalTextTab";
import QASidebar from "@/components/QASidebar";
import PaymentFlow from "@/components/PaymentFlow";

interface DocumentDashboardProps {
  documentId: string;
  language: string;
  sessionId: string;
  onDelete: () => void;
}

export default function DocumentDashboard({ documentId, language, sessionId, onDelete }: DocumentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "glossary" | "original">("summary");
  const { toast } = useToast();

  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ["/api/documents", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}`, {
        headers: {
          'x-session-id': sessionId
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    }
  });

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'x-session-id': sessionId
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      toast({
        title: "Document deleted",
        description: "Your document has been successfully deleted.",
      });

      onDelete();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    toast({
      title: "Export feature coming soon",
      description: "Document export functionality will be available in a future update.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return 'fas fa-file-pdf text-destructive';
    if (fileType.includes('word')) return 'fas fa-file-word text-primary';
    if (fileType.includes('text')) return 'fas fa-file-alt text-muted-foreground';
    if (fileType.includes('image')) return 'fas fa-file-image text-green-500';
    return 'fas fa-file text-muted-foreground';
  };

  const pageCount = document.pageCount || 1;

  // Show payment flow if payment is pending
  if (document.paymentStatus === "pending") {
    return (
      <PaymentFlow
        documentId={documentId}
        filename={document.filename}
        pageCount={pageCount}
        sessionId={sessionId}
        onPaymentSuccess={() => {
          // Reload the document data after successful payment
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content Area */}
      <div className="lg:col-span-2">
        {/* File Info */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                <i className={getFileIcon(document.fileType)}></i>
              </div>
              <div>
                <h4 className="font-semibold text-foreground" data-testid="text-filename">
                  {document.filename}
                </h4>
                <p className="text-sm text-muted-foreground" data-testid="text-file-details">
                  {formatFileSize(document.fileSize)} • {pageCount} pages • Processed {document.createdAt ? new Date(document.createdAt).toLocaleString() : 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                className="bg-secondary text-secondary-foreground px-3 py-1 rounded text-sm hover:bg-secondary/80 transition-colors"
                onClick={handleExport}
                data-testid="button-export"
              >
                <i className="fas fa-download mr-1"></i> Export
              </button>
              <button 
                className="bg-destructive text-destructive-foreground px-3 py-1 rounded text-sm hover:bg-destructive/90 transition-colors"
                onClick={handleDelete}
                data-testid="button-delete"
              >
                <i className="fas fa-trash mr-1"></i> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <div className="bg-card border border-border rounded-lg">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          
          <div className="p-6 tab-content">
            {activeTab === "summary" && (
              <SummaryTab documentId={documentId} language={language} sessionId={sessionId} />
            )}
            {activeTab === "glossary" && (
              <GlossaryTab documentId={documentId} language={language} sessionId={sessionId} />
            )}
            {activeTab === "original" && (
              <OriginalTextTab document={{
                originalText: document.originalText || undefined,
                processedSections: document.processedSections as any[] || undefined
              }} />
            )}
          </div>
        </div>
      </div>

      {/* Q&A Sidebar */}
      <div className="lg:col-span-1">
        <QASidebar documentId={documentId} language={language} sessionId={sessionId} />
      </div>
    </div>
  );
}
