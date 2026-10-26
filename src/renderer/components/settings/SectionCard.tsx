import React from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/** 设置分类内的卡片容器 */
export function SectionCard({ title, description, icon, children }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-line/10 bg-surface p-5 shadow-glass">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon}
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-ink-subtle">{description}</p>}
      </div>
      {children}
    </section>
  );
}
