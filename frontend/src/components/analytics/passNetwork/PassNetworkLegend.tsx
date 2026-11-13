import React from 'react';
import type { PassNetworkTacticalMetrics } from './passNetworkGeometry';

export interface PassNetworkLegendProps {
  metrics: PassNetworkTacticalMetrics;
  viewMode: 'cumulative' | 'match';
  teamColor: string;
}

/** Diagnostic legend and footer strip explaining node size, edge thickness, and spatial metrics. */
export const PassNetworkLegend: React.FC<PassNetworkLegendProps> = ({
  metrics,
  viewMode,
  teamColor,
}) => (
  <div className="mt-auto pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-normal">
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow-xs"
          style={{ backgroundColor: teamColor }}
        />
        <span>Tamaño = pases · Grosor = combinaciones</span>
      </span>
      {metrics.avgPassHeightPct !== null && (
        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
          Altura media: {metrics.avgPassHeightPct}%
        </span>
      )}
      {metrics.teamWidthPct !== null && (
        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
          Amplitud: {metrics.teamWidthPct}u
        </span>
      )}
    </div>
    <div className="flex items-center gap-3">
      <span>
        {metrics.visibleEdgeCount} conexiones (
        {viewMode === 'match' ? '11 titulares en cancha' : `${metrics.nodeCount} titulares acumulados`})
      </span>
    </div>
  </div>
);
