import React, { useState } from 'react';
import { 
  User, 
  Calendar, Loader2, Copy, Check, Zap, Target
} from 'lucide-react';
import type { RefereeDetailResponse } from '../../types/referee';
import { buildRefereeReport } from '../../services/refereeReportBuilder';

interface RefereeDetailPanelProps {
  detail: RefereeDetailResponse | null;
  isLoading: boolean;
  historyLimit: number;
  onLimitChange: (limit: number) => void;
}

export const RefereeDetailPanel: React.FC<RefereeDetailPanelProps> = ({
  detail,
  isLoading,
  historyLimit,
  onLimitChange,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyReport = async () => {
    if (!detail) return;
    try {
      const markdown = buildRefereeReport({
        referee: detail.referee,
        recentMatches: detail.recent_matches,
      });
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy referee report:', err);
    }
  };

  if (isLoading && !detail) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-8 flex flex-col items-center justify-center min-h-[420px] shadow-xs">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Cargando expediente arbitral...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-8 flex flex-col items-center justify-center min-h-[420px] text-center shadow-xs">
        <User className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-sm font-bold text-slate-700">Selecciona un árbitro</h3>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          Haz clic en cualquier fila de la tabla para ver el perfil disciplinario detallado y sus últimos partidos.
        </p>
      </div>
    );
  }

  const { referee, recent_matches, total_matches } = detail;

  return (
    <div className="space-y-4">
      {/* 1. HEADER CARD WITH KPIS */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs relative overflow-hidden">
        {/* Top Badges, Identity & Horizontal Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {referee.name}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {referee.country}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>Liga 1 Perú 2026</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">{referee.matches_count} partidos dirigidos</span>
            </p>
          </div>

          {/* Top-Right Side-by-Side Flex Container */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            {/* Neutral Market Line Pill */}
            <span
              className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-tight border ${
                referee.over_4_5_cards_pct >= 60
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : referee.over_4_5_cards_pct >= 40
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              Over +4.5: {referee.over_4_5_cards_pct.toFixed(0)}%
            </span>

            {/* Copiar Ficha Arbitral Button */}
            <button
              type="button"
              onClick={handleCopyReport}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-xs active:scale-98'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Ficha</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* KPI Grid (5 Quick Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4">
          {/* KPI 1: Tarjetas/PJ (strictly 2 decimals for both yellows and reds) */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 text-center">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
              Tarjetas / PJ
            </span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
              {referee.cards_avg.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">
              {referee.yellow_cards_avg.toFixed(2)} Am · {referee.red_cards_avg.toFixed(2)} Ro
            </span>
          </div>

          {/* KPI 2: Penales/PJ */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 text-center">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
              Penales / PJ
            </span>
            <span className={`text-lg font-bold font-mono mt-0.5 block ${referee.penalties_avg >= 0.5 ? 'text-amber-600' : 'text-slate-900'}`}>
              {referee.penalties_avg.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">
              {referee.penalties_total} en {referee.matches_count} PJ
            </span>
          </div>

          {/* KPI 3: Faltas/PJ */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 text-center">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
              Faltas / PJ
            </span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
              {referee.fouls_avg.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400">cobradas x partido</span>
          </div>

          {/* KPI 4: Expulsiones Totales */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 text-center">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
              Rojas Totales
            </span>
            <span className={`text-lg font-bold font-mono mt-0.5 block ${referee.red_cards_total >= 5 ? 'text-rose-600' : 'text-slate-900'}`}>
              {referee.red_cards_total}
            </span>
            <span className="text-[10px] text-slate-400">
              {referee.red_cards_avg.toFixed(2)} / partido
            </span>
          </div>

          {/* KPI 5: Sesgo Local */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 text-center col-span-2 sm:col-span-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
              Sesgo Local
            </span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
              {referee.home_cards_pct.toFixed(0)}%
            </span>
            <span className="text-[10px] text-slate-400">tarjetas al local</span>
          </div>
        </div>
      </div>

      {/* 2. MATCH HISTORY HEADER & TOGGLE */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Historial de Partidos ({historyLimit === 5 ? `Últimos ${recent_matches.length}` : `Todos: ${total_matches}`})
          </h3>
        </div>

        {/* 5 Matches vs Full History Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => onLimitChange(5)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              historyLimit === 5
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Últimos 5
          </button>
          <button
            type="button"
            onClick={() => onLimitChange(0)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              historyLimit === 0
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Historial Completo
          </button>
        </div>
      </div>

      {/* 3. RECENT MATCH CARDS (ONEFA STYLE) */}
      <div className="space-y-3 max-h-[580px] overflow-y-auto pr-0.5">
        {recent_matches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            No se encontraron partidos registrados para este colegiado.
          </div>
        ) : (
          recent_matches.map((m) => {
            const formattedDate = m.date ? m.date.slice(0, 10) : '';
            return (
              <div
                key={m.match_id}
                className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs hover:border-slate-300 transition-all"
              >
                {/* Match Header: Tournament, Round, Date, Market Badges */}
                <div className="flex items-center justify-between text-xs pb-2.5 mb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <span className="font-semibold text-slate-800">{m.tournament}</span>
                    {m.round && (
                      <>
                        <span>•</span>
                        <span>Fecha {m.round}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="font-mono text-[11px] text-slate-400">{formattedDate}</span>
                  </div>

                  {/* Unified Market Badge: Over 4.5 vs Under 4.5 */}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight ${
                      m.over_4_5_cards
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {m.over_4_5_cards ? 'Over 4.5' : 'Under 4.5'}
                  </span>
                </div>

                {/* Match Score & Teams */}
                <div className="grid grid-cols-7 items-center gap-2 py-1">
                  {/* Home Team */}
                  <div className="col-span-3 flex items-center gap-2 justify-end text-right">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {m.home_team.short_name || m.home_team.name}
                    </span>
                    {m.home_team.logo_url && (
                      <img
                        src={m.home_team.logo_url}
                        alt={m.home_team.name}
                        className="w-5 h-5 object-contain shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>

                  {/* Score */}
                  <div className="col-span-1 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-900 text-xs">
                      {m.home_score} - {m.away_score}
                    </span>
                  </div>

                  {/* Away Team */}
                  <div className="col-span-3 flex items-center gap-2 justify-start text-left">
                    {m.away_team.logo_url && (
                      <img
                        src={m.away_team.logo_url}
                        alt={m.away_team.name}
                        className="w-5 h-5 object-contain shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {m.away_team.short_name || m.away_team.name}
                    </span>
                  </div>
                </div>

                {/* Standardized Card Footer & Badge Order */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs">
                  {/* 1. Yellow Cards with split */}
                  <span className="inline-flex items-center gap-1.5 text-slate-700 text-[11px] font-medium bg-amber-50/70 border border-amber-200/80 px-2 py-0.5 rounded-md">
                    <span className="w-2.5 h-3 bg-amber-400 rounded-xs inline-block shrink-0 shadow-2xs" />
                    <span className="font-bold text-slate-900">
                      {m.yellow_cards} {m.yellow_cards === 1 ? 'Amarilla' : 'Amarillas'}
                    </span>
                    {m.yellow_cards_split && (
                      <span className="text-slate-500 font-mono text-[10.5px]">
                        (1T: {m.yellow_cards_split.first_half} | 2T: {m.yellow_cards_split.second_half})
                      </span>
                    )}
                  </span>

                  {/* 2. Red Cards (only if > 0) */}
                  {m.red_cards > 0 && (
                    <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md font-bold border border-rose-200 text-[11px]">
                      <span className="w-2.5 h-3 bg-rose-600 rounded-xs inline-block" />
                      <span>{m.red_cards} {m.red_cards === 1 ? 'Roja' : 'Rojas'}</span>
                    </span>
                  )}

                  {/* 3. Penalties (only if > 0) */}
                  {m.penalties > 0 && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-bold border border-amber-200 text-[11px]">
                      <Target className="w-3 h-3 text-amber-600" />
                      <span>{m.penalties} {m.penalties === 1 ? 'Penal' : 'Penales'}</span>
                    </span>
                  )}

                  {/* 4. Total Fouls */}
                  <span className="inline-flex items-center gap-1 text-slate-600 text-[11px] font-mono ml-auto">
                    <Zap className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-slate-700">{m.fouls}</span>
                    <span>{m.fouls === 1 ? 'falta' : 'faltas'}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RefereeDetailPanel;
