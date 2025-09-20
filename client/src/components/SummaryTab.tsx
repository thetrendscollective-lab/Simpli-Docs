import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Tooltip from "@/components/Tooltip";

interface SummaryTabProps {
  documentId: string;
  language: string;
}

interface DocumentSummary {
  overview: string;
  keyFindings: string[];
  recommendations: string[];
  nextSteps: string[];
  riskFlags: string[];
}

export default function SummaryTab({ documentId, language }: SummaryTabProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["/api/documents", documentId, "summary", language],
    queryFn: async () => {
      const response = await apiRequest("POST", `/api/documents/${documentId}/summarize`, {
        language
      });
      return await response.json() as DocumentSummary;
    },
    enabled: !!documentId,
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

  if (!summary) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Failed to generate summary. Please try again.</p>
      </div>
    );
  }

  // Sample terms for tooltip demonstration
  const tooltipTerms = [
    { term: "cholesterol", definition: "A type of fat in your blood. High levels can increase heart disease risk." },
    { term: "blood sugar", definition: "The amount of glucose (sugar) in your blood. Normal fasting levels are 70-99 mg/dL." },
    { term: "hypertension", definition: "High blood pressure. This means the force of blood against your artery walls is higher than it should be." }
  ];

  const addTooltips = (text: string) => {
    let processedText = text;
    tooltipTerms.forEach(({ term, definition }) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      processedText = processedText.replace(regex, (match) => 
        `<Tooltip term="${match}" definition="${definition}" />`
      );
    });
    return processedText;
  };

  return (
    <div className="space-y-6" data-testid="summary-content">
      {/* Main Summary */}
      <div className="bg-accent/50 border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-3">Document Summary</h3>
        <div className="text-foreground leading-relaxed">
          {summary.overview.split(' ').map((word, index) => {
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
        {summary.keyFindings && summary.keyFindings.length > 0 && (
          <div className="border border-border rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection('keyFindings')}
              data-testid="section-key-findings"
            >
              <div className="flex items-center space-x-3">
                <i className={`fas fa-chevron-right section-expander text-muted-foreground transition-transform ${
                  expandedSections.has('keyFindings') ? 'rotate-90' : ''
                }`}></i>
                <h4 className="font-semibold text-foreground">Key Findings & Results</h4>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Multiple Pages</span>
            </button>
            {expandedSections.has('keyFindings') && (
              <div className="p-4 pt-0 border-t border-border">
                <ul className="space-y-2 text-foreground">
                  {summary.keyFindings.map((finding, index) => (
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
        {summary.recommendations && summary.recommendations.length > 0 && (
          <div className="border border-border rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection('recommendations')}
              data-testid="section-recommendations"
            >
              <div className="flex items-center space-x-3">
                <i className={`fas fa-chevron-right section-expander text-muted-foreground transition-transform ${
                  expandedSections.has('recommendations') ? 'rotate-90' : ''
                }`}></i>
                <h4 className="font-semibold text-foreground">Recommendations</h4>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Page 3</span>
            </button>
            {expandedSections.has('recommendations') && (
              <div className="p-4 pt-0 border-t border-border">
                <ul className="space-y-2 text-foreground">
                  {summary.recommendations.map((recommendation, index) => (
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
        {summary.nextSteps && summary.nextSteps.length > 0 && (
          <div className="border border-border rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection('nextSteps')}
              data-testid="section-next-steps"
            >
              <div className="flex items-center space-x-3">
                <i className={`fas fa-chevron-right section-expander text-muted-foreground transition-transform ${
                  expandedSections.has('nextSteps') ? 'rotate-90' : ''
                }`}></i>
                <h4 className="font-semibold text-foreground">Next Steps</h4>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Page 3</span>
            </button>
            {expandedSections.has('nextSteps') && (
              <div className="p-4 pt-0 border-t border-border">
                <ul className="space-y-2 text-foreground">
                  {summary.nextSteps.map((step, index) => (
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
        {summary.riskFlags && summary.riskFlags.length > 0 && (
          <div className="border border-destructive/20 bg-destructive/5 rounded-lg">
            <button 
              className="w-full p-4 text-left flex items-center justify-between hover:bg-destructive/10 transition-colors"
              onClick={() => toggleSection('riskFlags')}
              data-testid="section-risk-flags"
            >
              <div className="flex items-center space-x-3">
                <i className={`fas fa-chevron-right section-expander text-muted-foreground transition-transform ${
                  expandedSections.has('riskFlags') ? 'rotate-90' : ''
                }`}></i>
                <h4 className="font-semibold text-destructive">⚠️ Important Notices</h4>
              </div>
            </button>
            {expandedSections.has('riskFlags') && (
              <div className="p-4 pt-0 border-t border-destructive/20">
                <ul className="space-y-2 text-foreground">
                  {summary.riskFlags.map((risk, index) => (
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
}
