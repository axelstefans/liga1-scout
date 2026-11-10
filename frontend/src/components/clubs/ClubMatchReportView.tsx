import React from 'react';
import { TeamMatchItem } from '../../services/api';
import { MatchReportSheetId, MATCH_REPORT_SHEETS } from './clubAnalyticsTypes';
import { formatMatchSelectorLabel } from './clubAnalyticsUtils';
import TacticalSheetErrorBoundary from './TacticalSheetErrorBoundary';
import MatchReportSheet01 from './MatchReportSheet01';
import MatchReportSheet02 from './MatchReportSheet02';
import MatchReportSheet03 from './MatchReportSheet03';

export interface ClubMatchReportViewProps {
  validReportMatchId: number | null;
  setReportMatchId: React.Dispatch<React.SetStateAction<number | null>>;
  isLoadingMatches: boolean;
  matches: TeamMatchItem[] | undefined;
  clubShortDisplay: string;
  activeSheet: MatchReportSheetId;
  setActiveSheet: React.Dispatch<React.SetStateAction<MatchReportSheetId>>;
}

export const ClubMatchReportView: React.FC<ClubMatchReportViewProps> = ({
  validReportMatchId,
  setReportMatchId,
  isLoadingMatches,
  matches,
  clubShortDisplay,
  activeSheet,
  setActiveSheet,
}) => {
  return (
    <div className="space-y-4">
      {/* Editorial Control Strip: Fixture Selector & 3-Sheet Sub-Navigation */}
      <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl px-4 pt-3 pb-0 flex flex-col gap-3">
        {/* Top Row: Fixture Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
              PARTIDO SELECCIONADO
            </span>
            <select
              value={validReportMatchId || ''}
              onChange={(e) => setReportMatchId(Number(e.target.value))}
              disabled={isLoadingMatches || !matches || matches.length === 0}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 cursor-pointer min-w-[300px] sm:min-w-[430px]"
            >
              {isLoadingMatches ? (
                <option value="">Cargando fixture del club...</option>
              ) : !matches || matches.length === 0 ? (
                <option value="">Sin partidos jugados en este filtro</option>
              ) : (
                matches.map((m) => (
                  <option key={`report-fixture-${m.match_id}`} value={m.match_id}>
                    {formatMatchSelectorLabel(m, clubShortDisplay)}
                  </option>
                ))
              )}
            </select>
          </div>

          <span className="font-mono text-[11px] text-slate-400">
            {matches ? `${matches.length} partidos disponibles` : ''}
          </span>
        </div>

        {/* Bottom Row: Segmented Control Sub-Navigation */}
        <div className="inline-flex p-1 bg-slate-100/80 rounded-lg border border-slate-200/60 gap-1 my-3 overflow-x-auto no-scrollbar">
          {MATCH_REPORT_SHEETS.map((sheet) => {
            const isActive = activeSheet === sheet.id;
            const isDisabled = sheet.disabled;
            return (
              <button
                key={sheet.id}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && setActiveSheet(sheet.id)}
                className={`px-3.5 py-1.5 text-xs transition-all whitespace-nowrap ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed font-medium text-slate-400'
                    : isActive
                    ? 'font-bold text-slate-900 bg-white shadow-sm border border-slate-200/50 rounded-md cursor-default'
                    : 'font-semibold text-slate-500 hover:text-slate-900 rounded-md cursor-pointer'
                }`}
              >
                {sheet.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Sheet Canvas */}
      {isLoadingMatches ? (
        <div className="bg-white border border-slate-200/80 rounded-xl">
          <p className="text-sm text-slate-400 py-12 text-center">
            Cargando fixture del club...
          </p>
        </div>
      ) : !matches || matches.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl">
          <p className="text-sm text-slate-400 py-12 text-center">
            El club seleccionado no registra partidos jugados en este torneo.
          </p>
        </div>
      ) : activeSheet === '01' ? (
        <TacticalSheetErrorBoundary resetKey={validReportMatchId}>
          <MatchReportSheet01 matchId={validReportMatchId} />
        </TacticalSheetErrorBoundary>
      ) : activeSheet === '02' ? (
        <TacticalSheetErrorBoundary resetKey={validReportMatchId}>
          <MatchReportSheet02 matchId={validReportMatchId} />
        </TacticalSheetErrorBoundary>
      ) : activeSheet === '03' ? (
        <TacticalSheetErrorBoundary resetKey={validReportMatchId}>
          <MatchReportSheet03 matchId={validReportMatchId} />
        </TacticalSheetErrorBoundary>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center space-y-2">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-800">
            {MATCH_REPORT_SHEETS.find((s) => s.id === activeSheet)?.label}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Esta lámina táctica se habilitará en las siguientes fases de implementación del Reporte de Partido.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClubMatchReportView;
