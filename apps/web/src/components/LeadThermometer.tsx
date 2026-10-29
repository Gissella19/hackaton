'use client';

import React from 'react';
import { LeadStatus } from '@hackaton/shared';

interface Props {
  status: LeadStatus;
  score?: number;
  compact?: boolean;
}

const CONFIGS: Record<
  LeadStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  HOT_LEAD: {
    label: 'Lead caliente',
    bg: 'bg-emerald-500/10 border-emerald-500/25',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400 animate-pulse'
  },
  INTERESTED: {
    label: 'Interesado',
    bg: 'bg-sky-500/10 border-sky-500/25',
    text: 'text-sky-300',
    dot: 'bg-sky-400'
  },
  DOUBTFUL: {
    label: 'Con dudas',
    bg: 'bg-amber-500/10 border-amber-500/25',
    text: 'text-amber-300',
    dot: 'bg-amber-400'
  },
  FRUSTRATED: {
    label: 'Frustrado',
    bg: 'bg-rose-500/10 border-rose-500/30',
    text: 'text-rose-300',
    dot: 'bg-rose-400 animate-pulse'
  }
};

export function mapSentimentToLeadStatus(sentiment: string | null | undefined): LeadStatus {
  const normalized = (sentiment || '').toLowerCase().trim();
  if (normalized === 'lead caliente' || normalized === 'hot_lead') return 'HOT_LEAD';
  if (normalized === 'dudoso' || normalized === 'doubtful') return 'DOUBTFUL';
  if (normalized === 'frustrado' || normalized === 'frustrated') return 'FRUSTRATED';
  return 'INTERESTED';
}

export function LeadThermometer({ status, score, compact = false }: Props) {
  const current = CONFIGS[status] || CONFIGS.INTERESTED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      } ${current.bg} ${current.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      <span>{current.label}</span>
      {typeof score === 'number' && !compact ? (
        <span className="font-mono text-[11px] opacity-75">{score}%</span>
      ) : null}
    </span>
  );
}
