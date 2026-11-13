import React from 'react';
import { formatOptaName } from '../../../utils/playerFormatters';
import {
  AttackZoneConfigItem,
  AttackZoneData,
  AttackZoneMode,
  computeBoxInfiltrationPct,
} from './attackZonesGeometry';

export interface AttackZonesTooltipProps {
  channelData: AttackZoneData | null;
  channelConfig: AttackZoneConfigItem | null;
  tooltipCoords: { x: number; y: number } | null;
  mode: AttackZoneMode;
}

/**
 * Interactive floating hover/locked tooltip showing channel entry stats,
 * box infiltration effectiveness, expected threat, and top protagonists.
 */
export const AttackZonesTooltip: React.FC<AttackZonesTooltipProps> = ({
  channelData,
  channelConfig,
  tooltipCoords,
  mode,
}) => {
  if (!channelData || !channelConfig || !tooltipCoords) return null;

  const boxEffPct = computeBoxInfiltrationPct(
    channelData.entries_count,
    channelData.box_infiltrations
  ).toFixed(1);

  return (
    <div
      style={{
        left: Math.max(12, Math.min(tooltipCoords.x - 110, 310)),
        top: Math.max(12, tooltipCoords.y - 120),
      }}
      className="absolute pointer-events-none z-30 w-64 bg-slate-900/95 backdrop-blur-xs text-white rounded-xl shadow-xl p-3 border border-slate-700/80 text-xs transition-all animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800">
        <span className="font-bold text-slate-100 text-xs">
          {channelConfig.name}
        </span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
          {channelData.share_pct}% vol
        </span>
      </div>

      {/* Metrics */}
      <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-400">Incursiones:</span>
          <span className="font-semibold text-slate-100">
            {channelData.entries_count} ent. ({channelData.box_infiltrations} al área)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Efectividad al área:</span>
          <span className="font-semibold text-amber-400">{boxEffPct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">
            {mode === 'for' ? 'Peligro Generado:' : 'Peligro Concedido:'}
          </span>
          <span className="font-semibold text-slate-100">
            {channelData.threat_xg.toFixed(2)} xG ({channelData.threat_pct}%)
          </span>
        </div>
      </div>

      {/* Top Protagonistas */}
      <div className="mt-2 pt-2 border-t border-slate-800/80">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Top Protagonistas
        </span>
        {channelData.top_players && channelData.top_players.length > 0 ? (
          <div className="space-y-1">
            {channelData.top_players.map((p, idx) => (
              <div key={`${p.name}-${idx}`} className="flex justify-between text-[11px]">
                <span className="text-slate-200 truncate max-w-[140px] font-medium">
                  {formatOptaName(p.name)}
                </span>
                <span className="text-amber-400 font-bold">{p.actions_count} act.</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-slate-500 italic">
            Sin registros individuales suficientes
          </span>
        )}
      </div>
    </div>
  );
};

export default AttackZonesTooltip;
