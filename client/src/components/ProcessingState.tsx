interface ProcessingStateProps {
  state: "uploading" | "processing";
}

export default function ProcessingState({ state }: ProcessingStateProps) {
  const messages = {
    uploading: {
      title: "Uploading your document...",
      description: "Transferring file to server",
      progress: 35
    },
    processing: {
      title: "Processing your document...",
      description: "OCR scanning and analyzing content",
      progress: 65
    }
  };

  const currentMessage = messages[state];

  return (
    <div className="mb-8">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div>
            <h3 className="font-semibold text-foreground">{currentMessage.title}</h3>
            <p className="text-sm text-muted-foreground">{currentMessage.description}</p>
          </div>
        </div>
        <div className="mt-4 bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500" 
            style={{ width: `${currentMessage.progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
