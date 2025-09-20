import { useState } from "react";

interface OriginalTextTabProps {
  document: {
    originalText?: string;
    processedSections?: Array<{
      id: string;
      title: string;
      content: string;
      pageNumbers: number[];
    }>;
  };
}

export default function OriginalTextTab({ document }: OriginalTextTabProps) {
  const [selectedPage, setSelectedPage] = useState(1);

  if (!document.originalText) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Original text not available.</p>
      </div>
    );
  }

  // Extract pages from original text
  const pages = document.originalText.split(/--- Page \d+ ---/).filter(Boolean);
  const pageNumbers = Array.from({ length: pages.length }, (_, i) => i + 1);

  return (
    <div className="bg-muted rounded-lg p-4" data-testid="original-text-content">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Original Document Text</h3>
        <select 
          className="bg-background border border-border rounded px-3 py-1 text-sm"
          value={selectedPage}
          onChange={(e) => setSelectedPage(Number(e.target.value))}
          data-testid="select-page"
        >
          {pageNumbers.map(pageNum => (
            <option key={pageNum} value={pageNum}>
              Page {pageNum}
            </option>
          ))}
        </select>
      </div>
      
      <div className="bg-card border border-border rounded p-4 max-h-96 overflow-y-auto">
        <pre className="text-sm text-foreground font-mono leading-relaxed whitespace-pre-wrap">
          {pages[selectedPage - 1] || document.originalText}
        </pre>
      </div>
    </div>
  );
}
