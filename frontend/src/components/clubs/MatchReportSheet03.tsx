import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  getMatchSheet03DataHub,
  MatchSheet03DataHubResponse,
  DataHubMetricRow,
} from '../../services/api';
import { getTeamCrestUrl } from '../../utils/teams';
import { useScoutingLanguage } from '../../i18n/scoutingReport';
import {
  formatEditorialDate,
  resolveEditorialTeamPalette,
} from './matchReportSheet01Utils';
import MatchReportSheet03PlayerTable from './MatchReportSheet03PlayerTable';
import { formatMatchReportText } from './matchReportClipboard';
import {
  MatchContextFrieze,
  GoalsAndGameStateModule,
  HalvesBreakdownModule,
  TacticalChannelsAndTypologyModule,
} from './MatchReportSheet03Modules';

export interface MatchReportSheet03Props {
  matchId: number | null;
}

function formatDisplayValue(val: number | string, unit?: string | null): string {
  if (typeof val === 'number') {
    if (unit === '%') return `${val}%`;
    if (unit === 'm') return `${val} m`;
    return String(val);
  }
  return String(val);
}

function extractProportionRatio(
  homeVal: number | string,
  awayVal: number | string
): { hRatio: number; aRatio: number } | null {
  const parseNumber = (v: number | string): number => {
    if (typeof v === 'number') return v;
    const match = String(v).match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const h = parseNumber(homeVal);
  const a = parseNumber(awayVal);
  if (isNaN(h) || isNaN(a)) return null;

  const minVal = Math.min(h, a);
  let adjH = h;
  let adjA = a;
  if (minVal < 0) {
    adjH -= minVal;
    adjA -= minVal;
  }

  const sum = adjH + adjA;
  if (sum <= 0) {
    return { hRatio: 50, aRatio: 50 };
  }
  const hRatio = Math.round((adjH / sum) * 100);
  return { hRatio, aRatio: 100 - hRatio };
}

interface DataHubRowProps {
  row: DataHubMetricRow;
  homeColor: string;
  awayColor: string;
}

const DataHubRow: React.FC<DataHubRowProps> = ({ row, homeColor, awayColor }) => {
  const ratio = useMemo(
    () => extractProportionRatio(row.home_val, row.away_val),
    [row.home_val, row.away_val]
  );

  return (
    <div className="py-1.5 border-b border-slate-100 flex items-center justify-between text-xs">
      {/* Valor Local (izquierda) */}
      <span className="w-[60px] text-right font-mono font-bold text-slate-800 shrink-0">
        {formatDisplayValue(row.home_val, row.unit)}
      </span>

      {/* Columna Central (métrica y fuente) */}
      <div className="flex-1 px-3 text-center flex flex-col items-center justify-center min-w-0">
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <span className="text-slate-600 font-medium truncate">{row.label}</span>
          {row.source === 'sofascore' && (
            <span className="text-[9px] font-mono text-slate-400 border border-slate-200 px-1 rounded leading-tight uppercase">
              SOFASCORE
            </span>
          )}
          {row.source === 'flashscore' && (
            <span className="text-[9px] font-mono text-slate-400 border border-slate-200 px-1 rounded leading-tight uppercase">
              FLASHSCORE
            </span>
          )}
        </div>

        {/* Micro-barra horizontal comparativa (2px) */}
        {ratio && (
          <div className="w-24 sm:w-28 h-[2px] bg-slate-100 flex overflow-hidden rounded-full mt-1">
            <div
              style={{ width: `${ratio.hRatio}%`, backgroundColor: homeColor }}
              className="h-full transition-all"
            />
            <div
              style={{ width: `${ratio.aRatio}%`, backgroundColor: awayColor }}
              className="h-full transition-all"
            />
          </div>
        )}
      </div>

      {/* Valor Visitante (derecha) */}
      <span className="w-[60px] text-left font-mono font-bold text-slate-800 shrink-0">
        {formatDisplayValue(row.away_val, row.unit)}
      </span>
    </div>
  );
};

export const MatchReportSheet03: React.FC<MatchReportSheet03Props> = ({ matchId }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { lang, setLang, t } = useScoutingLanguage();

  const { data, isLoading, isError, error, refetch } = useQuery<MatchSheet03DataHubResponse>({
    queryKey: ['matches', matchId, 'sheet-03-datahub'],
    queryFn: () => getMatchSheet03DataHub(matchId!),
    enabled: Boolean(matchId),
    staleTime: 1000 * 60 * 10,
  });

  const isEs = lang === 'es';

  const palette = useMemo(() => {
    if (!data?.metadata?.home_team || !data?.metadata?.away_team) {
      return { homeColor: '#0f172a', awayColor: '#0369a1', areColorsSimilar: false };
    }
    return resolveEditorialTeamPalette(
      data.metadata.home_team.team_id,
      data.metadata.home_team.name,
      data.metadata.away_team.team_id,
      data.metadata.away_team.name
    );
  }, [data]);

  const handleCopyClipboard = async () => {
    if (!data) return;
    try {
      const text = formatMatchReportText(data, isEs) || data.clipboard_text || '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  const handleExportPNG = async () => {
    const node = sheetRef.current;
    if (!node || !data || isExporting) return;

    try {
      setIsExporting(true);

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      const images = Array.from(node.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete) {
            return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );

      const contentHeight = Math.max(1350, node.scrollHeight || 1350);
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        width: 1080,
        height: contentHeight,
        canvasWidth: 2160,
        canvasHeight: Math.round(contentHeight * 2),
        pixelRatio: 1,
        filter: (domNode) => {
          if (domNode instanceof HTMLElement && domNode.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        },
        style: {
          width: '1080px',
          maxWidth: '1080px',
          minWidth: '1080px',
          height: `${contentHeight}px`,
          maxHeight: `${contentHeight}px`,
          minHeight: `${contentHeight}px`,
          margin: '0',
          transform: 'none',
          overflow: 'visible',
        },
      });

      const sanitize = (val: string) => val.trim().replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '');
      const homeTeamStr = sanitize(data.metadata.home_team.short_name || data.metadata.home_team.name);
      const awayTeamStr = sanitize(data.metadata.away_team.short_name || data.metadata.away_team.name);
      const dateStr = data.metadata.match_date ? data.metadata.match_date.slice(0, 10) : String(data.match_id);

      const link = document.createElement('a');
      link.download = `MatchReport_Sheet03_${homeTeamStr}_${awayTeamStr}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting Match Report Sheet 03 PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!matchId) {
    return (
      <div className="bg-white border border-slate-200 p-10 text-center text-slate-500 font-mono text-xs uppercase tracking-widest">
        {isEs ? 'SELECCIONE UN PARTIDO DEL FIXTURE PARA VISUALIZAR EL REPORTE' : 'SELECT A FIXTURE MATCH TO VIEW REPORT'}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 p-14 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-slate-700" />
        <span className="font-mono text-xs uppercase tracking-widest">
          {isEs ? 'CARGANDO LÁMINA 03: DATA HUB ESTADÍSTICO...' : 'LOADING SHEET 03: DATA HUB...'}
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white border border-rose-200 p-8 flex flex-col items-center justify-center gap-3 text-rose-700">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider">
          {isEs ? 'NO SE PUDO CARGAR LA LÁMINA 03' : 'FAILED TO LOAD SHEET 03'}
        </p>
        <p className="text-xs text-rose-600 font-mono max-w-md text-center">
          {error instanceof Error ? error.message : 'Error al conectar con la API de análisis'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isEs ? 'REINTENTAR' : 'RETRY'}
        </button>
      </div>
    );
  }

  const {
    metadata,
    attack_metrics,
    passing_metrics,
    defense_metrics,
    discipline_metrics,
    home_players = [],
    away_players = [],
  } = data;
  const { home_team, away_team } = metadata;
  const { homeColor, awayColor } = palette;
  const homeCrest = getTeamCrestUrl(home_team.team_id, home_team.logo_url ?? undefined);
  const awayCrest = getTeamCrestUrl(away_team.team_id, away_team.logo_url ?? undefined);
  const formattedDate = formatEditorialDate(metadata.match_date, [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'
  ]);

  return (
    <div className="w-full flex flex-col items-center pb-12">
      {/* 0. BARRA DE UTILIDADES (Copiar texto, Idioma & Export PNG) */}
      <div className="w-[1080px] mx-auto mb-3 flex items-center justify-between export-ignore">
        <div className="flex items-center gap-3">
          {/* Selector de idioma */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => setLang('es')}
              className={`px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase transition cursor-pointer ${
                isEs ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase transition cursor-pointer ${
                !isEs ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              EN
            </button>
          </div>

          {/* Botón Copiar estadísticas */}
          <button
            type="button"
            onClick={handleCopyClipboard}
            className="border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5"
          >
            <span>
              {copied
                ? (isEs ? 'Copiado al portapapeles' : 'Copied to clipboard')
                : (isEs ? 'Copiar estadísticas' : 'Copy statistics')}
            </span>
          </button>
        </div>

        {/* Botón Exportar PNG */}
        <button
          type="button"
          onClick={handleExportPNG}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-mono text-[11px] uppercase tracking-wider transition cursor-pointer"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>{isExporting ? (isEs ? 'EXPORTANDO...' : 'EXPORTING...') : (isEs ? 'EXPORTAR PNG' : 'EXPORT PNG')}</span>
        </button>
      </div>

      {/* CANONICAL EDITORIAL CANVAS (1080px fixed layout) */}
      <div
        ref={sheetRef}
        className="w-[1080px] min-w-[1080px] max-w-[1080px] min-h-[1350px] mx-auto bg-white p-8 text-slate-900 select-none flex flex-col justify-between overflow-hidden"
      >
        <div>
          {/* 1.1 META SUPERIOR */}
          <div className="flex items-center justify-between mb-2 font-mono text-[11px] text-slate-400">
            <span>{isEs ? 'LIGA 1 TE APUESTO · REPORTE DE PARTIDO' : 'LIGA 1 TE APUESTO · MATCH REPORT'}</span>
            <span>{isEs ? 'LÁMINA 03 / 03' : 'SHEET 03 / 03'}</span>
          </div>

          {/* 1.2 TÍTULO Y SUBTÍTULO EN SENTENCE CASE */}
          <div className="mt-0.5 mb-3">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Match statistics and performance data hub
            </h1>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Comprehensive metric consolidation comparing Sofascore and Flashscore event data.
            </p>
          </div>

          {/* 1.3 MARCADOR CENTRAL */}
          <div className="w-full flex items-center justify-between py-2 border-y border-slate-100">
            {/* Extrema izquierda: Escudo Local + Nombre corto */}
            <div className="flex items-center gap-3 flex-1 justify-start min-w-0">
              <img
                src={getTeamCrestUrl(home_team.team_id, home_team.logo_url ?? undefined)}
                alt={home_team.name}
                className="w-9 h-9 object-contain shrink-0"
              />
              <span className="text-lg font-bold text-slate-900 truncate">
                {home_team.short_name || home_team.name}
              </span>
            </div>

            {/* Centro: Marcador y torneo/fecha */}
            <div className="flex flex-col items-center justify-center shrink-0 px-8">
              <div className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums whitespace-nowrap">
                {home_team.score} – {away_team.score}
              </div>
              <div className="text-center font-mono text-[11px] text-slate-400 mt-0.5">
                {[metadata.tournament, formattedDate].filter(Boolean).join(' · ')}
              </div>
            </div>

            {/* Extrema derecha: Nombre corto + Escudo Visitante */}
            <div className="flex items-center gap-3 flex-1 justify-end min-w-0 text-right">
              <span className="text-lg font-bold text-slate-900 truncate">
                {away_team.short_name || away_team.name}
              </span>
              <img
                src={getTeamCrestUrl(away_team.team_id, away_team.logo_url ?? undefined)}
                alt={away_team.name}
                className="w-9 h-9 object-contain shrink-0"
              />
            </div>
          </div>

          {/* 1.4 FRANJA DE CONTEXTO (Sede, Altitud, Superficie, Árbitro) */}
          <MatchContextFrieze
            venue={data.venue}
            referee={data.referee}
            t={t.matchSheet03}
          />

          {/* 1.5 CRONOLOGÍA DE GOLES Y ESTADO DE JUEGO */}
          <GoalsAndGameStateModule
            goals={data.goals_chronology}
            cards={data.card_incidents}
            gameState={data.game_state}
            homeTeam={home_team}
            awayTeam={away_team}
            homeColor={homeColor}
            awayColor={awayColor}
            areColorsSimilar={palette.areColorsSimilar}
            t={t.matchSheet03}
          />

          {/* 2. GRID DE 4 PANELES TEMÁTICOS (2 columnas × 2 filas) */}
          <div className="grid grid-cols-2 gap-8 mt-6">
            {/* Panel 1: Calidad de Ocasiones y Remate */}
            <div className="flex flex-col">
              <div className="border-b-2 border-slate-900 pb-1.5 mb-2 flex items-center justify-between">
                <h2 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase">
                  {isEs ? '01 · CALIDAD DE OCASIONES Y REMATE' : '01 · CHANCE QUALITY & SHOOTING'}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: homeColor }} />
                    {home_team.short_name || 'LOC'}
                  </span>
                  <span>vs</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: awayColor }} />
                    {away_team.short_name || 'VIS'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                {attack_metrics.map((row) => (
                  <DataHubRow
                    key={row.key}
                    row={row}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ))}
              </div>
            </div>

            {/* Panel 2: Construcción y Distribución */}
            <div className="flex flex-col">
              <div className="border-b-2 border-slate-900 pb-1.5 mb-2 flex items-center justify-between">
                <h2 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase">
                  {isEs ? '02 · CONSTRUCCIÓN Y DISTRIBUCIÓN' : '02 · BUILD-UP & DISTRIBUTION'}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: homeColor }} />
                    {home_team.short_name || 'LOC'}
                  </span>
                  <span>vs</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: awayColor }} />
                    {away_team.short_name || 'VIS'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                {passing_metrics.map((row) => (
                  <DataHubRow
                    key={row.key}
                    row={row}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ))}
              </div>
            </div>

            {/* Panel 3: Presión, Duelos y Portería */}
            <div className="flex flex-col">
              <div className="border-b-2 border-slate-900 pb-1.5 mb-2 flex items-center justify-between">
                <h2 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase">
                  {isEs ? '03 · PRESIÓN, DUELOS Y PORTERÍA' : '03 · PRESSING, DUELS & GOALKEEPING'}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: homeColor }} />
                    {home_team.short_name || 'LOC'}
                  </span>
                  <span>vs</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: awayColor }} />
                    {away_team.short_name || 'VIS'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                {defense_metrics.map((row) => (
                  <DataHubRow
                    key={row.key}
                    row={row}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ))}
              </div>
            </div>

            {/* Panel 4: Disciplina y Pelota Parada */}
            <div className="flex flex-col">
              <div className="border-b-2 border-slate-900 pb-1.5 mb-2 flex items-center justify-between">
                <h2 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase">
                  {isEs ? '04 · DISCIPLINA Y PELOTA PARADA' : '04 · DISCIPLINE & SET PIECES'}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: homeColor }} />
                    {home_team.short_name || 'LOC'}
                  </span>
                  <span>vs</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: awayColor }} />
                    {away_team.short_name || 'VIS'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                {discipline_metrics.map((row) => (
                  <DataHubRow
                    key={row.key}
                    row={row}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 2.5 DESGLOSE POR MITADES Y ANÁLISIS ESPACIAL/REMATES */}
          <div className="grid grid-cols-2 gap-8 mt-8 pt-5 border-t border-slate-200">
            <HalvesBreakdownModule
              halves={data.half_period_stats}
              homeShort={home_team.short_name || home_team.name}
              awayShort={away_team.short_name || away_team.name}
              homeColor={homeColor}
              awayColor={awayColor}
              t={t.matchSheet03}
            />
            <TacticalChannelsAndTypologyModule
              homeChannels={data.home_attack_channels}
              awayChannels={data.away_attack_channels}
              homeShots={data.home_shot_typology}
              awayShots={data.away_shot_typology}
              homeShort={home_team.short_name || home_team.name}
              awayShort={away_team.short_name || away_team.name}
              homeColor={homeColor}
              awayColor={awayColor}
              t={t.matchSheet03}
            />
          </div>

          {/* 3. BLOQUE 05 · RENDIMIENTO INDIVIDUAL Y ALINEACIONES */}
          <div className="mt-8 pt-5 border-t border-slate-200">
            <div className="border-b-2 border-slate-900 pb-1.5 mb-4 flex items-center justify-between">
              <h2 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase">
                {isEs ? '05 · RENDIMIENTO INDIVIDUAL Y ALINEACIONES' : '05 · INDIVIDUAL PERFORMANCE & LINEUPS'}
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: homeColor }} />
                  {home_team.short_name || 'LOC'} ({home_players.length})
                </span>
                <span>vs</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: awayColor }} />
                  {away_team.short_name || 'VIS'} ({away_players.length})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-4">
              {/* Columna 1: Plantel Local */}
              <MatchReportSheet03PlayerTable
                teamName={home_team.name}
                isHome={true}
                teamColor={homeColor}
                crestUrl={homeCrest}
                players={home_players}
                isEs={isEs}
              />

              {/* Columna 2: Plantel Visitante */}
              <MatchReportSheet03PlayerTable
                teamName={away_team.name}
                isHome={false}
                teamColor={awayColor}
                crestUrl={awayCrest}
                players={away_players}
                isEs={isEs}
              />
            </div>
          </div>
        </div>

        {/* 4. EDITORIAL FOOTER */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between font-mono text-[10px] text-slate-400">
          <span>LIGA 1 SCOUT INTELLIGENCE PLATFORM · DATA HUB</span>
          <span>SOFASCORE & FLASHSCORE STATISTICAL CONSENSUS</span>
        </div>
      </div>
    </div>
  );
};

export default MatchReportSheet03;
