import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type QAInteraction } from "@shared/schema";

interface QASidebarProps {
  documentId: string;
  language: string;
  sessionId: string;
}


interface QAResult {
  answer: string;
  citations: Array<{
    pageNumber: number;
    sectionId: string;
    text: string;
  }>;
  confidence: number;
}

export default function QASidebar({ documentId, language, sessionId }: QASidebarProps) {
  const [question, setQuestion] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: qaHistory = [], isLoading } = useQuery<QAInteraction[]>({
    queryKey: ["/api/documents", documentId, "qa"],
    enabled: !!documentId,
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/qa`, {
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

  const askQuestionMutation = useMutation({
    mutationFn: async (questionText: string) => {
      const response = await fetch(`/api/documents/${documentId}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ question: questionText, language }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return await response.json() as QAResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/documents", documentId, "qa"] 
      });
      setQuestion("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to get answer",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    askQuestionMutation.mutate(question.trim());
  };

  return (
    <div className="bg-card border border-border rounded-lg h-full flex flex-col" data-testid="qa-sidebar">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center">
          <i className="fas fa-comments mr-2 text-primary"></i>
          Ask Questions
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Get answers about your document with source citations
        </p>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-96">
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}

        {qaHistory.length === 0 && !isLoading && (
          <div className="text-center p-4">
            <p className="text-sm text-muted-foreground">
              Ask a question about your document to get started.
            </p>
          </div>
        )}

        {qaHistory.map((qa: QAInteraction, index: number) => (
          <div key={qa.id || index} className="chat-message" data-testid={`qa-${index}`}>
            <div className="bg-primary/10 rounded-lg p-3 mb-2">
              <p className="text-sm text-foreground">{qa.question}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-foreground mb-2">{qa.answer}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {qa.confidence !== null && qa.confidence !== undefined && (
                  <span 
                    className={`inline-block text-xs px-2 py-1 rounded font-medium ${
                      qa.confidence >= 80 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : qa.confidence >= 60 
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}
                    data-testid={`confidence-${index}`}
                  >
                    {qa.confidence}% confident
                  </span>
                )}
                {Array.isArray(qa.citations) && qa.citations.length > 0 && (
                  <>
                    {qa.citations.map((citation: any, citIndex: number) => (
                      <span 
                        key={citIndex}
                        className="inline-block bg-primary/20 text-primary text-xs px-2 py-1 rounded"
                      >
                        Page {citation.pageNumber}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {askQuestionMutation.isPending && (
          <div className="chat-message">
            <div className="bg-primary/10 rounded-lg p-3 mb-2">
              <p className="text-sm text-foreground">{question}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input 
            type="text" 
            placeholder="Ask about your document..." 
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={askQuestionMutation.isPending}
            data-testid="input-question"
          />
          <button 
            type="submit"
            className="bg-primary text-primary-foreground px-3 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={!question.trim() || askQuestionMutation.isPending}
            data-testid="button-ask"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Answers are based on your uploaded document only
        </p>
      </div>
    </div>
  );
}
