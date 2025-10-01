import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface GlossaryTabProps {
  documentId: string;
  language: string;
  sessionId: string;
  regeneratedContent?: any;
}

interface GlossaryTerm {
  term: string;
  definition: string;
  pageRefs?: number[];
}

export default function GlossaryTab({ documentId, language, sessionId, regeneratedContent }: GlossaryTabProps) {
  const { data: glossary, isLoading } = useQuery({
    queryKey: ["/api/documents", documentId, "glossary", language],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/glossary`, {
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
      
      return await response.json() as GlossaryTerm[];
    },
    enabled: !!documentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Extracting terms...</span>
      </div>
    );
  }

  // Use regenerated glossary if available
  const displayGlossary = regeneratedContent?.glossary || glossary;

  if (!displayGlossary || displayGlossary.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No technical terms found in the document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="glossary-content">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Technical Terms Explained ({displayGlossary.length} terms)
      </h3>
      
      {displayGlossary.map((term: GlossaryTerm, index: number) => (
        <div key={index} className="border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-foreground font-mono" data-testid={`term-${index}`}>
                {term.term}
              </h4>
              <p className="text-foreground mt-2" data-testid={`definition-${index}`}>
                {term.definition}
              </p>
            </div>
            <div className="ml-4">
              {term.pageRefs && term.pageRefs.length > 0 && (
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  Page {term.pageRefs.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
