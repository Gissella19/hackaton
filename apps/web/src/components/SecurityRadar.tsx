'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { SecurityIncident } from '@hackaton/shared';

interface Props {
  incidents: SecurityIncident[];
  activeSecurityFlag?: boolean;
  activeSecurityReason?: string | null;
  onClearSecurityFlag?: () => void;
}

export function SecurityRadar({
  incidents,
  activeSecurityFlag = false,
  activeSecurityReason = null,
  onClearSecurityFlag
}: Props) {
  const hasAlerts = activeSecurityFlag || incidents.length > 0;

  if (!hasAlerts) {
    return (
      <div className="rounded-xl border border-[#1E2638] bg-[#0B0F17] px-3.5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-slate-300">Sin incidentes de seguridad</span>
        </div>
        <span className="font-mono text-[11px] text-emerald-400/90">Protegido</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-500/30 bg-[#0B0F17] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <h3 className="text-xs font-medium text-slate-200">Estado de seguridad</h3>
        </div>
        <span className="rounded-full bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 font-mono text-[11px] text-rose-300">
          {incidents.length + (activeSecurityFlag ? 1 : 0)} alerta(s)
        </span>
      </div>

      {activeSecurityFlag ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/25 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Intento de manipulación bloqueado
            </span>
            {onClearSecurityFlag ? (
              <button
                type="button"
                onClick={onClearSecurityFlag}
                className="text-[11px] text-slate-300 hover:text-white underline underline-offset-2"
              >
                Marcar revisado
              </button>
            ) : null}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activeSecurityReason ||
              'Se detectó un intento de alterar precios o instrucciones del sistema. Los aranceles oficiales permanecen bloqueados.'}
          </p>
        </div>
      ) : null}

      {incidents.length > 0 ? (
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {incidents.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-[#1E2638] bg-[#07090E] p-2.5 space-y-1 text-xs"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-rose-300">{item.attack_type}</span>
                <span
                  suppressHydrationWarning
                  className="font-mono text-slate-500"
                >
                  {(() => {
                    const d = new Date(item.detected_at);
                    if (Number.isNaN(d.getTime())) return '--:--';
                    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(
                      d.getUTCMinutes()
                    ).padStart(2, '0')}`;
                  })()}
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400 line-clamp-2 break-words">
                &ldquo;{item.raw_input}&rdquo;
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
