'use client';

import React from 'react';
import { LeadStatus } from '@hackaton/shared';

interface Props {
  status: LeadStatus;
  score: number;
}

export function LeadThermometer({ status, score }: Props) {
  const configs: Record<LeadStatus, { label: string; bg: string; text: string; dot: string }> = {
    HOT_LEAD: {
      label: 'Lead Caliente 🔥',
      bg: 'bg-emerald-950/70 border-emerald-500/50',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400 animate-pulse'
    },
    INTERESTED: {
      label: 'Interesado 💡',
      bg: 'bg-blue-950/70 border-blue-500/50',
      text: 'text-blue-400',
      dot: 'bg-blue-400'
    },
    DOUBTFUL: {
      label: 'Dudoso ❓',
      bg: 'bg-amber-950/70 border-amber-500/50',
      text: 'text-amber-400',
      dot: 'bg-amber-400'
    },
    FRUSTRATED: {
      label: 'Frustrado ⚠️',
      bg: 'bg-rose-950/70 border-rose-500/50',
      text: 'text-rose-400',
      dot: 'bg-rose-500 animate-ping'
    }
  };

  const current = configs[status] || configs.INTERESTED;

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${current.bg} ${current.text}`}>
      <span className={`w-2 h-2 rounded-full ${current.dot}`} />
      <span>{current.label} ({score}%)</span>
    </div>
  );
}
