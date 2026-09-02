import React from 'react';

export interface Tab<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
}

export function TabBar<T extends string>({ tabs, activeTab, onChange }: TabBarProps<T>) {
  return (
    <div className="tabs">
      {tabs.map(({ key, label, count }) => (
        <button
          key={key}
          className={activeTab === key ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          {label}
          {count !== undefined && count > 0 && (
            <span className="tab-count">{count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
