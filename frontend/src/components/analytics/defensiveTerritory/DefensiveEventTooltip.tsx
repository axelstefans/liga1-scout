import React from 'react';
import { DefensiveEventItem } from '../../../services/api';
import { formatOptaName } from '../../../utils/playerFormatters';
import { ACTION_CONFIG } from './defensiveTerritoryGeometry';
import { renderDefensiveShape } from './DefensiveShapeMarker';

export interface DefensiveEventTooltipProps {
  hoveredEvent: DefensiveEventItem | null;
  tooltipPos: { x: number; y: number } | null;
}

/**
 * Interactive floating hover tooltip displaying player details and defensive action metrics.
 */
export const DefensiveEventTooltip: React.FC<DefensiveEventTooltipProps> = ({
  hoveredEvent,
  tooltipPos,
}) => {
  if (!hoveredEvent || !tooltipPos) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-900/95 text-white rounded-lg shadow-xl px-3 py-2 text-xs backdrop-blur-xs border border-slate-700/80 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        left: tooltipPos.x,
        top: tooltipPos.y - 8,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {hoveredEvent.jersey && (
          <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-300 border border-slate-700">
            #{hoveredEvent.jersey}
          </span>
        )}
        <span className="font-semibold text-white">
          {formatOptaName(hoveredEvent.player_name)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="-6 -6 12 12" className="shrink-0 overflow-visible">
            {renderDefensiveShape(hoveredEvent.type, 0, 0, 1.1)}
          </svg>
          <span className="capitalize">
            {ACTION_CONFIG[hoveredEvent.type as keyof typeof ACTION_CONFIG]?.singular ||
              hoveredEvent.type}
          </span>
        </div>
        <span
          className={
            hoveredEvent.is_success
              ? 'text-emerald-400 font-medium'
              : 'text-rose-400 font-medium'
          }
        >
          {hoveredEvent.type === 'foul'
            ? 'Cometida'
            : hoveredEvent.is_success
            ? 'Exitosa'
            : 'No exitosa'}
        </span>
      </div>
      <div className="mt-1 text-[10px] text-slate-400">
        Ubicación: x={hoveredEvent.x}% • y={hoveredEvent.y}%
      </div>
    </div>
  );
};

export default DefensiveEventTooltip;
