import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { type Document } from "@shared/schema";
import TabNavigation from "@/components/TabNavigation";
import SummaryTab from "@/components/SummaryTab";
import GlossaryTab from "@/components/GlossaryTab";
import OriginalTextTab from "@/components/OriginalTextTab";
import QASidebar from "@/components/QASidebar";
import PaymentFlow from "@/components/PaymentFlow";
import { queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DocumentDashboardProps {
  documentId: string;
  language: string;
  sessionId: string;
  onDelete: () => void;
}

export default function DocumentDashboard({ documentId, language, sessionId, onDelete }: DocumentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "glossary" | "original">("summary");
  const [readingLevel, setReadingLevel] = useState<'simple' | 'standard' | 'detailed'>('standard');
  const [regeneratedContent, setRegeneratedContent] = useState<any>(null);
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

  const regenerateMutation = useMutation({
    mutationFn: async (level: 'simple' | 'standard' | 'detailed') => {
      const response = await fetch(`/api/documents/${documentId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ readingLevel: level, language }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setRegeneratedContent(data);
      toast({
        title: "Reading level changed",
        description: `Document regenerated at ${readingLevel} level.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to regenerate",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleReadingLevelChange = (value: string) => {
    const level = value as 'simple' | 'standard' | 'detailed';
    setReadingLevel(level);
    regenerateMutation.mutate(level);
  };

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

        {/* Reading Level Selector */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-grow">
              <Label htmlFor="reading-level-selector" className="text-sm font-medium mb-2 block">
                Reading Level Dropdown
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Choose from Simple to Professional, with a level in between
              </p>
              <Select 
                value={readingLevel} 
                onValueChange={handleReadingLevelChange}
                disabled={regenerateMutation.isPending}
              >
                <SelectTrigger id="reading-level-selector" className="w-full" data-testid="select-reading-level">
                  <SelectValue placeholder="Select reading level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple (5th grade) - Plain language, short sentences</SelectItem>
                  <SelectItem value="standard">Standard (8th-10th grade) - Clear, general language</SelectItem>
                  <SelectItem value="detailed">Professional - Full context, technical terms allowed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {regenerateMutation.isPending && (
              <div className="flex items-center text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                Regenerating...
              </div>
            )}
          </div>
        </div>

        {/* Tabbed Content */}
        <div className="bg-card border border-border rounded-lg">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          
          <div className="p-6 tab-content">
            {activeTab === "summary" && (
              <SummaryTab 
                documentId={documentId} 
                language={language} 
                sessionId={sessionId}
                regeneratedContent={regeneratedContent}
              />
            )}
            {activeTab === "glossary" && (
              <GlossaryTab 
                documentId={documentId} 
                language={language} 
                sessionId={sessionId}
                regeneratedContent={regeneratedContent}
              />
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
