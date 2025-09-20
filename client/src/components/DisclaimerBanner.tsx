import { useState } from "react";

export default function DisclaimerBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-warning text-warning-foreground px-4 py-3 border-b border-border">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <i className="fas fa-exclamation-triangle text-lg"></i>
          <span className="text-sm font-medium">
            This tool provides plain-language explanations for informational purposes only and is not legal or medical advice. Consult a licensed professional for guidance.
          </span>
        </div>
        <button 
          className="text-warning-foreground hover:opacity-80 transition-opacity"
          onClick={() => setIsVisible(false)}
          data-testid="button-dismiss-disclaimer"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
}
