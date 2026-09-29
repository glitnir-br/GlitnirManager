import React from 'react';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, glowColor, subtitle }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-card border border-border p-6 group hover:border-border/80 transition-all duration-300",
    )}>
      {/* Glow effect */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-500"
        style={{ background: glowColor }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${glowColor}22` }}
        >
          <Icon className="w-5 h-5" style={{ color: glowColor }} />
        </div>
      </div>
    </div>
  );
}
