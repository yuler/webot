import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  to: string;
  badge?: ReactNode;
  isActive?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  className?: string;
  ariaLabel?: string;
}

/**
 * Mobile-first clean tab bar component for console navigation.
 * Guarantees strictly mutually exclusive active tab highlight (only one active at a time).
 */
export function Tabs({ items, className = "", ariaLabel = "控制台功能切换" }: TabsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Determine active tab: strictly single-choice
  const activeId = (() => {
    const explicit = items.find((t) => t.isActive === true);
    if (explicit) return explicit.id;

    const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

    // 1. Exact match
    const exact = items.find((t) => {
      const target = t.to.endsWith("/") && t.to.length > 1 ? t.to.slice(0, -1) : t.to;
      return target === normalized;
    });
    if (exact) return exact.id;

    // 2. Sub-route prefix match (excluding fallback root paths)
    const prefix = items.find((t) => {
      if (t.to === "/console" || t.to === "/console/bind") return false;
      return normalized.startsWith(t.to);
    });
    if (prefix) return prefix.id;

    // 3. Fallback to first tab
    return items[0]?.id;
  })();

  return (
    <nav className={`tabs-nav ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      <div className="tabs-list">
        {items.map((tab) => {
          const isActive = tab.isActive ?? tab.id === activeId;
          return (
            <Link
              key={tab.id}
              to={tab.to}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              activeOptions={{ exact: true }}
              className={`tab-item${isActive ? " is-active" : ""}`}
            >
              <span className="tab-label">{tab.label}</span>
              {tab.badge != null && tab.badge !== "" ? (
                <span className="tab-badge tabular">
                  {typeof tab.badge === "number" ? `（${tab.badge}）` : tab.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
