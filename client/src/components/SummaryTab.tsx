import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Tooltip from "@/components/Tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type Document } from "@shared/schema";
import { FileText, Languages, AlertCircle, ChevronRight } from "lucide-react";

interface SummaryTabProps {
  documentId: string;
  language: string;
  sessionId: string;
  regeneratedContent?: any;
}

interface DocumentSummary {
  overview: string;
  keyFindings: string[];
  recommendations: string[];
  nextSteps: string[];
  riskFlags: string[];
}

export default function SummaryTab({ documentId, language, sessionId, regeneratedContent }: SummaryTabProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sideBySideView, setSideBySideView] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["/api/documents", documentId, "summary", language, sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ language }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return await response.json() as DocumentSummary;
    },
    enabled: !!documentId,
  });

  const { data: document, isLoading: isDocumentLoading, isError: isDocumentError, error: documentError, refetch: refetchDocument } = useQuery<Document>({
    queryKey: ["/api/documents", documentId, sessionId],
    enabled: !!documentId && !!sessionId && sideBySideView,
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

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Generating summary...</span>
      </div>
    );
  }

  // Use regenerated content if available, otherwise use the summary from the query
  const displayContent = regeneratedContent || summary;

  if (!displayContent) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Failed to generate summary. Please try again.</p>
      </div>
    );
  }

  // Convert regenerated content format to DocumentSummary format if needed
  const displaySummary: DocumentSummary = regeneratedContent ? {
    overview: regeneratedContent.summary || '',
    keyFindings: regeneratedContent.keyPoints || [],
    recommendations: regeneratedContent.actionItems || [],
    nextSteps: [],
    riskFlags: []
  } : summary!;

  // Sample terms for tooltip demonstration
  const tooltipTerms = [
    { term: "cholesterol", definition: "A type of fat in your blood. High levels can increase heart disease risk." },
    { term: "blood sugar", definition: "The amount of glucose (sugar) in your blood. Normal fasting levels are 70-99 mg/dL." },
    { term: "hypertension", definition: "High blood pressure. This means the force of blood against your artery walls is higher than it should be." }
  ];

  const summaryContent = (
    <div className="space-y-6">
      {/* Main Summary */}
      <div className="bg-accent/50 border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-3">Document Summary</h3>
        <div className="text-foreground leading-relaxed">
          {displaySummary.overview.split(' ').map((word, index) => {
            const tooltipTerm = tooltipTerms.find(t => 
              t.term.toLowerCase() === word.toLowerCase().replace(/[.,!?;]/, '')
            );
            
            if (tooltipTerm) {
              return (
                <Tooltip 
                  key={index}
                  term={word}
                  definition={tooltipTerm.definition}
                />
              );
            }
            return word + ' ';
          })}
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-4">
        {/* Key Findings */}
        {displaySummary.keyFindings && displaySummary.keyFindings.length > 0 && (
          <div className="border border-border rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection('keyFindings')}
              data-testid="section-key-findings"
            >
              <div className="flex items-center space-x-3">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedSections.has('keyFindings') ? 'rotate-90' : ''
                }`} />
                <h4 className="font-semibold text-foreground">Key Findings & Results</h4>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Multiple Pages</span>
            </button>
            {expandedSections.has('keyFindings') && (
              <div className="p-4 pt-0 border-t border-border">
                <ul className="space-y-2 text-foreground">
                  {displaySummary.keyFindings.map((finding, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {displaySummary.recommendations && displaySummary.recommendations.length > 0 && (
          <div className="border border-border rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection('recommendations')}
              data-testid="section-recommendations"
            >
              <div className="flex items-center space-x-3">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedSections.has('recommendations') ? 'rotate-90' : ''
                }`} />
                <h4 className="font-semibold text-foreground">Recommendations</h4>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Page 3</span>
            </button>
            {expandedSections.has('recommendations') && (
              <div className="p-4 pt-0 border-t border-border">
                <ul className="space-y-2 text-foreground">
                  {displaySummary.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Next Steps */}
        {displaySummary.nextSteps && displaySummary.nextSteps.length > 0 && (
          <div className="border border-border rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection('nextSteps')}
              data-testid="section-next-steps"
            >
              <div className="flex items-center space-x-3">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedSections.has('nextSteps') ? 'rotate-90' : ''
                }`} />
                <h4 className="font-semibold text-foreground">Next Steps</h4>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Page 3</span>
            </button>
            {expandedSections.has('nextSteps') && (
              <div className="p-4 pt-0 border-t border-border">
                <ul className="space-y-2 text-foreground">
                  {displaySummary.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Risk Flags */}
        {displaySummary.riskFlags && displaySummary.riskFlags.length > 0 && (
          <div className="border border-destructive/20 bg-destructive/5 rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-destructive/10 transition-colors"
              onClick={() => toggleSection('riskFlags')}
              data-testid="section-risk-flags"
            >
              <div className="flex items-center space-x-3">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                  expandedSections.has('riskFlags') ? 'rotate-90' : ''
                }`} />
                <h4 className="font-semibold text-destructive">⚠️ Important Notices</h4>
              </div>
            </button>
            {expandedSections.has('riskFlags') && (
              <div className="p-4 pt-0 border-t border-destructive/20">
                <ul className="space-y-2 text-foreground">
                  {displaySummary.riskFlags.map((risk, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="summary-content">
      {/* Side-by-Side Toggle */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
        <div className="flex items-center space-x-2">
          <Label htmlFor="side-by-side-toggle" className="text-sm font-medium cursor-pointer">
            Side-by-Side View
          </Label>
          <span className="text-xs text-muted-foreground">Compare original with plain English</span>
        </div>
        <Switch
          id="side-by-side-toggle"
          checked={sideBySideView}
          onCheckedChange={setSideBySideView}
          data-testid="toggle-side-by-side"
        />
      </div>

      {/* Content Display */}
      {sideBySideView ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Original Text */}
          <div className="bg-muted/30 border border-border rounded-lg p-4" data-testid="original-text-pane">
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Original Document
            </h3>
            <div className="bg-card border border-border rounded p-4 max-h-[600px] overflow-y-auto" data-testid="text-original">
              {isDocumentLoading ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading original text...</span>
                </div>
              ) : isDocumentError ? (
                <div className="text-center p-4">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-destructive mb-3">
                    Failed to load original text: {documentError?.message || 'Unknown error'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchDocument()}
                    data-testid="button-retry-original"
                  >
                    Retry
                  </Button>
                </div>
              ) : document?.originalText ? (
                <pre className="text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap">
                  {document.originalText}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm text-center p-4">
                  No extracted text available for this document.
                </p>
              )}
            </div>
          </div>

          {/* Plain English Summary */}
          <div className="bg-accent/30 border border-border rounded-lg p-4" data-testid="summary-pane">
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
              <Languages className="h-5 w-5 mr-2" />
              Plain English
            </h3>
            <div className="max-h-[600px] overflow-y-auto" data-testid="text-summary">
              {summaryContent}
            </div>
          </div>
        </div>
      ) : (
        summaryContent
      )}
    </div>
  );
}
