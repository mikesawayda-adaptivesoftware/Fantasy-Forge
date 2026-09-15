'use client';

import { KeyboardEvent, ReactNode, useRef } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon?: string;
}

interface TabsProps<K extends string> {
  tabs: readonly TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  idPrefix: string;
  label: string;
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs */
export function TabList<K extends string>({ tabs, active, onChange, idPrefix, label }: TabsProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex(t => t.key === active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex gap-2 border-b border-field-border pb-2 overflow-x-auto" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab, i) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={el => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-tab-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              selected ? 'bg-turf text-black' : 'text-text-secondary hover:text-white hover:bg-field-card'
            }`}
          >
            {tab.icon && <span aria-hidden>{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, activeKey, children }: { idPrefix: string; activeKey: string; children: ReactNode }) {
  return (
    <div id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${activeKey}`} tabIndex={0} className="focus:outline-none">
      {children}
    </div>
  );
}
