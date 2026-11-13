import React from 'react';
import { AttackZoneMode, ZoneMetricSummary } from './attackZonesGeometry';

export interface AttackZonesKpiStripProps {
  summary: ZoneMetricSummary;
  mode: AttackZoneMode;
  dominantChannelName: string;
  mostDangerousChannelName: string;
  maxThreatXg: string;
}

/**
 * Top perspective-aware 5-card KPI strip for Attack Zones visualization.
 */
export const AttackZonesKpiStrip: React.FC<AttackZonesKpiStripProps> = ({
  summary,
  mode,
  dominantChannelName,
  mostDangerousChannelName,
  maxThreatXg,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-2">
      {/* KPI 1: Total Entradas */}
      <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
        <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
          {mode === 'for' ? 'Total Entradas' : 'Incursiones Recibidas'}
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-xl font-black text-slate-900 tracking-tight">
            {summary.total_entries}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">acc.</span>
        </div>
        <span className="text-[10px] text-slate-400 mt-0.5 truncate">
          Último tercio o área
        </span>
      </div>

      {/* KPI 2: Entradas al Área */}
      <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
        <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
          {mode === 'for' ? 'Entradas al Área' : 'Llegadas Concedidas'}
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-xl font-black text-slate-900 tracking-tight">
            {summary.box_entries_total}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">al área</span>
        </div>
        <span className="text-[10px] text-slate-400 mt-0.5 truncate">
          Infiltraciones en el área de 18m
        </span>
      </div>

      {/* KPI 3: % Infiltración al Área */}
      <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
        <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
          % Infiltración al Área
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-xl font-black text-amber-700 tracking-tight">
            {summary.box_entry_conversion_pct}%
          </span>
        </div>
        <span className="text-[10px] text-slate-400 mt-0.5 truncate">
          Conversión a penetración
        </span>
      </div>

      {/* KPI 4: Carril Dominante */}
      <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between">
        <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
          {mode === 'for' ? 'Carril Dominante' : 'Vía Más Frecuente'}
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-sm font-black text-slate-900 tracking-tight truncate">
            {dominantChannelName}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 mt-0.5 truncate">
          {mode === 'for' ? 'Mayor volumen ofensivo' : 'Mayor volumen rival'}
        </span>
      </div>

      {/* KPI 5: Mayor Peligro / Sector Más Vulnerable */}
      <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 flex flex-col justify-between col-span-2 md:col-span-1">
        <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
          {mode === 'for' ? 'Mayor Peligro' : 'Sector Más Vulnerable'}
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-sm font-black text-slate-900 tracking-tight truncate">
            {mostDangerousChannelName}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 mt-0.5 truncate">
          {mode === 'for' ? `${maxThreatXg} xG generado` : `${maxThreatXg} xGA recibido`}
        </span>
      </div>
    </div>
  );
};

export default AttackZonesKpiStrip;
