"use client";

import styles from "./tabs.module.css";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  count?: string;
  disabled?: boolean;
  disabledReason?: string;
};

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
};

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  ariaLabel,
}: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={styles.tabs}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          data-active={active === item.id}
          disabled={item.disabled}
          title={item.disabled ? item.disabledReason : undefined}
          onClick={() => !item.disabled && onChange(item.id)}
          className={styles.tab}
        >
          <span>{item.label}</span>
          {item.count !== undefined && (
            <span className={styles.count}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
