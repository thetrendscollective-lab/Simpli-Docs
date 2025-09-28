import { useState } from "react";
import { AlertTriangle, X, Scale, Stethoscope } from "lucide-react";

export default function DisclaimerBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-4 py-4 border-b-4 border-red-700 shadow-lg">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-full flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Scale className="h-5 w-5" />
                <Stethoscope className="h-5 w-5" />
                <span className="font-bold text-lg">⚠️ IMPORTANT DISCLAIMER</span>
              </div>
              <p className="text-sm leading-relaxed font-medium">
                <strong>This tool provides plain-language explanations for informational purposes only and is NOT legal or medical advice.</strong>
                <br />
                <span className="text-red-100">
                  Always consult with a licensed attorney, doctor, or other qualified professional for guidance specific to your situation.
                </span>
              </p>
            </div>
          </div>
          <button 
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0 ml-4"
            onClick={() => setIsVisible(false)}
            data-testid="button-dismiss-disclaimer"
            title="Dismiss disclaimer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Additional emphasis */}
        <div className="mt-4 pt-3 border-t border-red-400/30">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-red-100">
            <span>📋 Not professional advice</span>
            <span>⚖️ Not a substitute for legal counsel</span> 
            <span>🩺 Not a replacement for medical consultation</span>
            <span>💼 For educational purposes only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
