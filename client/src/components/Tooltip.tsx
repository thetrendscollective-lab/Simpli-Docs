import { useState } from "react";

interface TooltipProps {
  term: string;
  definition: string;
}

export default function Tooltip({ term, definition }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span 
      className="relative inline-block cursor-help border-b border-dotted border-primary text-primary font-medium"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {term}
      {isVisible && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-popover border border-border rounded-md shadow-lg">
          <div className="text-sm text-popover-foreground leading-relaxed">
            <strong className="font-medium">{term.replace(/[.,!?;]/, '')}</strong>
            <br />
            {definition}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border"></div>
        </div>
      )}
    </span>
  );
}
