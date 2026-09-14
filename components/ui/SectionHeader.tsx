import { ReactNode } from 'react';

interface SectionHeaderProps {
  icon: string;
  title: string;
  children?: ReactNode;
}

export default function SectionHeader({ icon, title, children }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl" aria-hidden>{icon}</span>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="flex-1 h-px bg-field-border" />
      {children}
    </div>
  );
}
