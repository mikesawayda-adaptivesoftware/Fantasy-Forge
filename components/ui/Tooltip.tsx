'use client';

import { useRef, useState, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

type Placement = 'center' | 'left' | 'right';

const TOOLTIP_MAX_WIDTH = 448; // max-w-md

export default function Tooltip({ content, children }: TooltipProps) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return setPlacement('center');
    const width = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - 20);
    const center = rect.left + rect.width / 2;
    if (center - width / 2 < 10) setPlacement('left');
    else if (center + width / 2 > window.innerWidth - 10) setPlacement('right');
    else setPlacement('center');
  };

  const position = placement === 'left' ? 'left-0' : placement === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  const arrow = placement === 'left' ? 'left-3' : placement === 'right' ? 'right-3' : 'left-1/2 -translate-x-1/2';

  return (
    <div className="relative inline-flex items-center" ref={triggerRef}>
      <div
        onMouseEnter={show}
        onMouseLeave={() => setPlacement(null)}
        onFocus={show}
        onBlur={() => setPlacement(null)}
        tabIndex={0}
        className="cursor-help"
      >
        {children}
      </div>

      {placement && (
        <div
          role="tooltip"
          className={`absolute bottom-full mb-3 px-4 py-3 bg-field-elevated border border-field-border rounded-xl shadow-xl text-sm text-text-primary z-50 animate-fade-in w-max max-w-[min(28rem,calc(100vw-20px))] leading-relaxed ${position}`}
        >
          {content}
          <div className={`absolute top-full -mt-px border-4 border-transparent border-t-field-border ${arrow}`} />
        </div>
      )}
    </div>
  );
}
