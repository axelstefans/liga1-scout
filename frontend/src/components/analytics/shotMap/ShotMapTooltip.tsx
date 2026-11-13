import React from 'react';
import { ShotItem } from '../../../services/api';
import { formatOptaName } from '../../../utils/playerFormatters';
import {
  RESULT_CONFIG,
  SITUATION_LABELS,
  BODY_PART_LABELS,
} from './shotMapGeometry';

export interface ShotTooltipPosition {
  x: number;
  y: number;
  yBottom: number;
  svgX: number;
  svgY: number;
}

export interface ShotMapTooltipProps {
  hoveredShot: ShotItem | null;
  tooltipPos: ShotTooltipPosition | null;
}

/**
 * Interactive floating hover tooltip for shot events with boundary-aware adaptive placement.
 */
export const ShotMapTooltip: React.FC<ShotMapTooltipProps> = ({
  hoveredShot,
  tooltipPos,
}) => {
  if (!hoveredShot || !tooltipPos) return null;

  const isNearTop = tooltipPos.svgY < 120;
  const isNearRight = tooltipPos.svgX > 380;
  const translateXClass = isNearRight ? '-translate-x-[85%]' : '-translate-x-1/2';
  const translateYClass = isNearTop ? 'translate-y-2' : '-translate-y-full';
  const topPos = isNearTop ? tooltipPos.yBottom + 6 : tooltipPos.y - 8;

  return (
    <div
      className={`fixed z-50 pointer-events-none transition-all duration-75 ${translateXClass} ${translateYClass}`}
      style={{ left: tooltipPos.x, top: topPos }}
    >
      <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-lg shadow-xl px-3 py-2 text-xs border border-slate-700/80 min-w-[190px]">
        {/* Header: Player Name & Jersey */}
        <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800">
          <span className="font-bold text-white tracking-tight">
            {hoveredShot.player_jersey ? `#${hoveredShot.player_jersey} ` : ''}
            {formatOptaName(hoveredShot.player_name)}
          </span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
              RESULT_CONFIG[hoveredShot.result]?.badgeBg || 'bg-slate-800'
            } ${RESULT_CONFIG[hoveredShot.result]?.badgeText || 'text-slate-300'} ${
              RESULT_CONFIG[hoveredShot.result]?.badgeBorder || 'border-slate-700'
            }`}
          >
            {RESULT_CONFIG[hoveredShot.result]?.singular || hoveredShot.result}
          </span>
        </div>

        {/* Metrics */}
        <div className="space-y-1 text-slate-300 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Probabilidad (xG):</span>
            <span className="font-semibold text-slate-200">{hoveredShot.xg.toFixed(2)}</span>
          </div>
          {hoveredShot.situation && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Situación:</span>
              <span className="text-slate-200">
                {SITUATION_LABELS[hoveredShot.situation] || hoveredShot.situation}
              </span>
            </div>
          )}
          {hoveredShot.body_part && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Ejecución:</span>
              <span className="text-slate-200">
                {BODY_PART_LABELS[hoveredShot.body_part] || hoveredShot.body_part}
              </span>
            </div>
          )}
          {hoveredShot.minute && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Minuto:</span>
              <span className="text-slate-200">{hoveredShot.minute}&apos;</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShotMapTooltip;
