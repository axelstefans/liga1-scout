import React from 'react';
import { ShotMode } from './shotMapGeometry';

export interface ShotEfficiencyBadgeProps {
  xgDifference: number;
  mode: ShotMode;
}

/**
 * Performance efficiency badge showing over/underperformance vs expected goals (xG).
 */
export const ShotEfficiencyBadge: React.FC<ShotEfficiencyBadgeProps> = ({
  xgDifference,
  mode,
}) => {
  const formattedDiff = `${xgDifference > 0 ? '+' : ''}${xgDifference.toFixed(2)}`;

  if (mode === 'for') {
    if (xgDifference >= 2.0) {
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap"
          title="Conversión por encima de la expectativa de gol"
        >
          <span className="font-mono font-bold">{formattedDiff} xG</span>
          <span>Sobrerendimiento</span>
        </span>
      );
    } else if (xgDifference <= -2.0) {
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs whitespace-nowrap"
          title="Genera más peligro esperado del que convierte"
        >
          <span className="font-mono font-bold">{formattedDiff} xG</span>
          <span>Déficit</span>
        </span>
      );
    } else {
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs whitespace-nowrap"
          title="Conversión alineada con la probabilidad de gol esperada"
        >
          <span className="font-mono font-bold">{formattedDiff} xG</span>
          <span className="text-slate-500">Conversión esperada</span>
        </span>
      );
    }
  }

  // Defensive 'against' mode
  if (xgDifference >= 2.0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs whitespace-nowrap"
        title="Concede más goles de lo esperado según la calidad del disparo rival"
      >
        <span className="font-mono font-bold">{formattedDiff} GC</span>
        <span>Vulnerabilidad</span>
      </span>
    );
  } else if (xgDifference <= -2.0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap"
        title="Eficacia defensiva: concede menos goles de lo esperado"
      >
        <span className="font-mono font-bold">{formattedDiff} GC</span>
        <span>Resistencia</span>
      </span>
    );
  } else {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs whitespace-nowrap"
        title="Goles concedidos alineados con la expectativa del rival"
      >
        <span className="font-mono font-bold">{formattedDiff} GC</span>
        <span className="text-slate-500">Concesión esperada</span>
      </span>
    );
  }
};

export default ShotEfficiencyBadge;
