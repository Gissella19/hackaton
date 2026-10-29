'use client';

import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { SecurityIncident } from '@hackaton/shared';

interface Props {
  incidents: SecurityIncident[];
}

export function SecurityRadar({ incidents }: Props) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <h3 className="font-semibold text-slate-200 text-sm">Radar de Seguridad (Prompt Defense)</h3>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
          {incidents.length} Eventos
        </span>
      </div>

      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
        {incidents.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2 text-center">
            No se han registrado intentos de inyección o jailbreak. Sistema seguro.
          </p>
        ) : (
          incidents.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50 flex flex-col gap-1 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {item.attack_type}
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(item.detected_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-slate-300 font-mono text-[11px] truncate bg-black/40 p-1 rounded">
                &ldquo;{item.raw_input}&rdquo;
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
