import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { RefereeSummary } from '../../types/referee';

interface RefereeTableProps {
  referees: RefereeSummary[];
  selectedRefereeId: number | null;
  onSelectReferee: (refereeId: number) => void;
  isLoading?: boolean;
}

export const RefereeTable: React.FC<RefereeTableProps> = ({
  referees,
  selectedRefereeId,
  onSelectReferee,
  isLoading = false,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Table Title Strip */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-navy" />
          <h2 className="text-sm font-bold text-slate-800">Ranking Disciplinario de Árbitros</h2>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
          {referees.length} árbitros
        </span>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[640px] divide-y divide-slate-100">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 text-slate-500 font-semibold tracking-wider uppercase text-[10.5px]">
            <tr>
              <th scope="col" className="py-2.5 pl-3.5 pr-1.5 text-center w-8">#</th>
              <th scope="col" className="py-2.5 px-3">Árbitro</th>
              <th scope="col" className="py-2.5 px-2 text-center" title="Partidos Dirigidos">PJ</th>
              <th scope="col" className="py-2.5 px-2 text-right" title="Amarillas por Partido">Am./PJ</th>
              <th scope="col" className="py-2.5 px-2 text-right" title="Rojas por Partido">Ro./PJ</th>
              <th scope="col" className="py-2.5 px-2 text-right font-bold text-slate-700" title="Total Tarjetas (Am + Ro) por Partido">Tarj./PJ</th>
              <th scope="col" className="py-2.5 px-2 text-right" title="Penales sancionados por Partido">Pen./PJ</th>
              <th scope="col" className="py-2.5 px-2 text-right" title="Faltas cobradas por Partido">Falt./PJ</th>
              <th scope="col" className="py-2.5 pr-4 pl-2 text-center" title="Porcentaje de partidos con más de 4.5 tarjetas totales">Línea +4.5</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={`skel-${i}`} className="animate-pulse">
                  <td colSpan={9} className="py-3 px-4">
                    <div className="h-4 bg-slate-100 rounded-md w-full" />
                  </td>
                </tr>
              ))
            ) : referees.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                  No hay datos arbitrales registrados para este filtro.
                </td>
              </tr>
            ) : (
              referees.map((ref, idx) => {
                const isSelected = selectedRefereeId === ref.referee_id;
                const isOverHigh = ref.over_4_5_cards_pct >= 60.0;
                const isOverMedium = ref.over_4_5_cards_pct >= 40.0 && ref.over_4_5_cards_pct < 60.0;

                return (
                  <tr
                    key={ref.referee_id}
                    onClick={() => onSelectReferee(ref.referee_id)}
                    className={`cursor-pointer transition-colors duration-150 group select-none ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-l-blue-600 font-medium text-slate-900'
                        : 'hover:bg-slate-50/90 text-slate-700'
                    }`}
                  >
                    {/* Index */}
                    <td className={`py-2.5 pl-3.5 pr-1.5 text-center font-mono text-[11px] ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>
                      {idx + 1}
                    </td>

                    {/* Referee Name */}
                    <td className="py-2.5 px-3 font-semibold text-slate-900 truncate max-w-[150px] sm:max-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{ref.name}</span>
                        {ref.red_cards_total >= 10 && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Alto índice de expulsiones" />
                        )}
                      </div>
                    </td>

                    {/* Matches Count */}
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-600 font-semibold">
                      {ref.matches_count}
                    </td>

                    {/* Yellows / PJ */}
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600">
                      {ref.yellow_cards_avg.toFixed(2)}
                    </td>

                    {/* Reds / PJ */}
                    <td className={`py-2.5 px-2 text-right font-mono tabular-nums ${ref.red_cards_avg >= 0.5 ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                      {ref.red_cards_avg.toFixed(2)}
                    </td>

                    {/* Cards / PJ (Total) */}
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-slate-900 bg-slate-50/50">
                      {ref.cards_avg.toFixed(2)}
                    </td>

                    {/* Penalties / PJ */}
                    <td className={`py-2.5 px-2 text-right font-mono tabular-nums ${ref.penalties_avg >= 0.5 ? 'text-amber-600 font-bold' : 'text-slate-600'}`}>
                      {ref.penalties_avg.toFixed(2)}
                    </td>

                    {/* Fouls / PJ */}
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600">
                      {ref.fouls_avg.toFixed(1)}
                    </td>

                    {/* +4.5 Line Pill */}
                    <td className="py-2.5 pr-4 pl-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-tight ${
                          isOverHigh
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : isOverMedium
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {ref.over_4_5_cards_pct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary Note */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <span>* Métricas cruzadas con actas oficiales y remates penales.</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> &gt;60% Over 4.5
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;40% Over 4.5
          </span>
        </span>
      </div>
    </div>
  );
};

export default RefereeTable;
