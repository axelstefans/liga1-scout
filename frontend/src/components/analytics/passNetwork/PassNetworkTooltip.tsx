import React from 'react';
import type { PassNetworkNode } from '../../../services/api';
import type { PassPartnerSummary } from './passNetworkGeometry';

export interface PassNetworkTooltipProps {
  hoveredNode: PassNetworkNode | null;
  tooltipPos: { x: number; y: number } | null;
  hoveredPartners: PassPartnerSummary[];
}

/** Floating dark interactive tooltip displaying player passing totals, pivot role, and top partners. */
export const PassNetworkTooltip: React.FC<PassNetworkTooltipProps> = ({
  hoveredNode,
  tooltipPos,
  hoveredPartners,
}) => {
  if (!hoveredNode || !tooltipPos) return null;

  return (
    <div
      className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-xs shadow-xl border border-slate-700/60 min-w-[210px] max-w-[260px] transition-all duration-100"
      style={{
        left: `${tooltipPos.x}px`,
        top: `${tooltipPos.y - 10}px`,
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
        <span className="font-bold text-white text-xs tracking-tight">{hoveredNode.name}</span>
        {hoveredNode.jersey && hoveredNode.jersey > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            #{hoveredNode.jersey}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] mb-2">
        <span className="text-slate-400">Pases completados:</span>
        <span className="font-mono font-bold text-emerald-400">{hoveredNode.total_passes}</span>
      </div>

      {hoveredNode.is_pivot && (
        <div className="flex items-center justify-between text-[11px] mb-1.5 pt-1.5 border-t border-slate-800">
          <span className="text-slate-400">Rol táctico:</span>
          <span className="font-semibold flex items-center gap-1 text-emerald-400">
            Pivote Defensivo
          </span>
        </div>
      )}

      {hoveredNode.defensive_actions_p90 !== undefined && hoveredNode.defensive_actions_p90 !== null && (
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="text-slate-400">Acciones def / 90:</span>
          <span className="font-mono font-bold text-slate-200">
            {hoveredNode.defensive_actions_p90.toFixed(2)}
          </span>
        </div>
      )}

      {hoveredPartners.length > 0 && (
        <div className="pt-1.5 border-t border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
            Principales Sociedades:
          </span>
          <div className="space-y-1">
            {hoveredPartners.map((partner, idx) => (
              <div key={`partner-${partner.partnerId}`} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 flex items-center gap-1">
                  <span className="text-slate-500 font-mono">{idx + 1}.</span>
                  <span>{partner.shortName}</span>
                  {partner.jersey && (
                    <span className="text-slate-500 text-[9.5px]">(#{partner.jersey})</span>
                  )}
                </span>
                <span className="font-mono font-semibold text-white">{partner.count} pases</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
