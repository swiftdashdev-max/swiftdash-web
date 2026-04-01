'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface NavSection {
  label: string;
  items: { id: string; label: string }[];
}

interface SidebarNavProps {
  sections: NavSection[];
}

export function SidebarNav({ sections }: SidebarNavProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const allIds = sections.flatMap((s) => s.items.map((i) => i.id));

    const observers: IntersectionObserver[] = [];

    const callback = (entries: IntersectionObserverEntry[]) => {
      // Pick the topmost visible section
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    };

    const observer = new IntersectionObserver(callback, {
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0,
    });

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    observers.push(observer);
    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  return (
    <nav className="py-6 pr-4">
      {sections.map((section) => (
        <div key={section.label} className="mb-6">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`
                      block rounded-md px-3 py-1.5 text-sm transition-colors
                      ${isActive
                        ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary pl-[10px]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }
                    `}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
