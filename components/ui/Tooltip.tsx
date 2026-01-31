'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'center' | 'left' | 'right'>('center');
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // Check if tooltip would overflow left
      const leftEdge = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
      // Check if tooltip would overflow right
      const rightEdge = triggerRect.left + (triggerRect.width / 2) + (tooltipRect.width / 2);
      
      if (leftEdge < 10) {
        setPosition('left'); // Align to left edge of trigger
      } else if (rightEdge > viewportWidth - 10) {
        setPosition('right'); // Align to right edge of trigger
      } else {
        setPosition('center'); // Center align
      }
    }
  }, [isVisible]);

  const getTooltipClasses = () => {
    const base = "absolute bottom-full mb-3 px-5 py-3 bg-field-elevated border border-field-border rounded-xl shadow-xl text-base text-text-primary z-50 animate-fade-in min-w-[280px] max-w-md leading-relaxed";
    
    switch (position) {
      case 'left':
        return `${base} left-0`;
      case 'right':
        return `${base} right-0`;
      default:
        return `${base} left-1/2 -translate-x-1/2`;
    }
  };

  const getArrowClasses = () => {
    const base = "absolute top-full -mt-px border-4 border-transparent border-t-field-border";
    
    switch (position) {
      case 'left':
        return `${base} left-3`;
      case 'right':
        return `${base} right-3`;
      default:
        return `${base} left-1/2 -translate-x-1/2`;
    }
  };

  return (
    <div className="relative inline-flex items-center" ref={triggerRef}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      
      {isVisible && (
        <div ref={tooltipRef} className={getTooltipClasses()}>
          {content}
          {/* Arrow */}
          <div className={getArrowClasses()} />
        </div>
      )}
    </div>
  );
}

