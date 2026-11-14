import type { ReactNode } from "react";

const SLUG_RE = /^[a-z0-9-]+$/;

export function categorySlug(raw: string): string {
  const s = (raw || "uncategorized").toLowerCase();
  return SLUG_RE.test(s) ? s : "uncategorized";
}

export function CategoryPill({ category, children }: { category: string; children: ReactNode }) {
  const slug = categorySlug(category);
  return <span className={`cat-pill cat-pill--${slug}`}>{children}</span>;
}

export function CategoryChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="cat-chips" role="listbox" aria-label={ariaLabel}>
      {options.map((o) => {
        const slug = categorySlug(o.value);
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={active}
            className={`cat-chip cat-chip--${slug}${active ? " is-active" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
