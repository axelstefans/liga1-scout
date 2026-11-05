import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { getMatchReportSheet02, MatchSheet02Response } from '../../services/api';
import { getTeamCrestUrl } from '../../utils/teams';
import { ScoutingLang, useScoutingLanguage } from '../../i18n/scoutingReport';
import {
  formatEditorialDate,
  formatNullableDecimal,
  formatNullableInt,
  resolveEditorialTeamPalette,
} from './matchReportSheet01Utils';
import {
  BoxEntriesPitchModule,
  EntryOriginLaneModule06,
  NestedPossessionStagesModule05,
  PassingShapeModule,
} from './MatchReportSheet02Modules';

export interface MatchReportSheet02Props {
  matchId: number | null;
}

export const MatchReportSheet02: React.FC<MatchReportSheet02Props> = ({ matchId }) => {
  // ALL HOOKS MUST RUN UNCONDITIONALLY AT THE TOP
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { lang, setLang } = useScoutingLanguage();

  const { data, isLoading, isError, error, refetch } = useQuery<MatchSheet02Response>({
    queryKey: ['matches', matchId, 'sheet-02'],
    queryFn: () => getMatchReportSheet02(matchId!),
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

  const handleExportPNG = async () => {
    const node = sheetRef.current;
    if (!node || !data || isExporting) return;

    try {
      setIsExporting(true);

      // 1. Garantizar carga previa de fuentes tipográficas e imágenes
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

      // 2. Exportación canónica determinista: 2400 x 3000 px exactos (4:5)
      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        width: 1080,
        height: 1350,
        canvasWidth: 2400,
        canvasHeight: 3000,
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
          height: '1350px',
          maxHeight: '1350px',
          minHeight: '1350px',
          margin: '0',
          transform: 'none',
          overflow: 'hidden',
        },
      });

      // 3. Descarga con nomenclatura editorial estándar
      const sanitize = (val: string) => val.trim().replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '');
      const homeTeamStr = sanitize(data.metadata.home_team.short_name || data.metadata.home_team.name);
      const awayTeamStr = sanitize(data.metadata.away_team.short_name || data.metadata.away_team.name);
      const dateStr = data.metadata.match_date ? data.metadata.match_date.slice(0, 10) : String(data.match_id);

      const link = document.createElement('a');
      link.download = `MatchReport_Sheet02_${homeTeamStr}_${awayTeamStr}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting Match Report Sheet 02 PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // EARLY RETURNS (AFTER ALL HOOKS)
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
          {isEs ? 'CARGANDO LÁMINA 02: CONSTRUCCIÓN Y ACCESO...' : 'LOADING SHEET 02: BUILD-UP & ACCESS...'}
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white border border-rose-200 p-8 flex flex-col items-center justify-center gap-3 text-rose-700">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider">
          {isEs ? 'NO SE PUDO CARGAR LA LÁMINA 02' : 'FAILED TO LOAD SHEET 02'}
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
    kpis,
    module_01_home_passing_shape,
    module_02_away_passing_shape,
    module_03_home_box_entries,
    module_04_away_box_entries,
  } = data;
  const { home_team, away_team } = metadata;
  const { homeColor, awayColor } = palette;
  const formattedDate = formatEditorialDate(metadata.match_date, [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'
  ]);

  const kpiItems = [
    {
      id: 'field_tilt',
      label: 'FIELD TILT',
      homeVal: kpis.field_tilt.home,
      awayVal: kpis.field_tilt.away,
      format: (v: number | null) => (v != null ? `${formatNullableDecimal(v, 1)}%` : '—'),
      maxScale: 100,
    },
    {
      id: 'progressive_passes',
      label: 'PROGRESSIVE PASSES',
      homeVal: kpis.progressive_passes.home,
      awayVal: kpis.progressive_passes.away,
      format: (v: number | null) => formatNullableInt(v),
      maxScale: Math.max(kpis.progressive_passes.home ?? 0, kpis.progressive_passes.away ?? 0, 1),
    },
    {
      id: 'line_breaking_passes',
      label: 'LINE-BREAKING PASSES',
      homeVal: kpis.line_breaking_passes.home,
      awayVal: kpis.line_breaking_passes.away,
      format: (v: number | null) => formatNullableInt(v),
      maxScale: Math.max(kpis.line_breaking_passes.home ?? 0, kpis.line_breaking_passes.away ?? 0, 1),
    },
    {
      id: 'box_entries',
      label: 'BOX ENTRIES',
      homeVal: kpis.box_entries.home,
      awayVal: kpis.box_entries.away,
      format: (v: number | null) => formatNullableInt(v),
      maxScale: Math.max(kpis.box_entries.home ?? 0, kpis.box_entries.away ?? 0, 1),
    },
  ];

  return (
    <div className="w-full overflow-x-auto">
      {/* Top Action Bar outside exported canvas */}
      <div className="max-w-[1080px] mx-auto mb-2 flex items-center justify-end gap-2 export-ignore">
        <div className="inline-flex border border-slate-300 bg-white font-mono text-[11px]">
          {(['es', 'en'] as ScoutingLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2.5 py-1 uppercase tracking-wider cursor-pointer transition ${
                lang === l
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportPNG}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-mono text-[11px] uppercase tracking-wider transition cursor-pointer"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>{isExporting ? (isEs ? 'EXPORTANDO...' : 'EXPORTING...') : (isEs ? 'EXPORTAR PNG' : 'EXPORT PNG')}</span>
        </button>
      </div>

      {/* SINGLE EDITORIAL CANVAS (1080px fixed layout) */}
      <div
        ref={sheetRef}
        className="w-[1080px] min-w-[1080px] max-w-[1080px] min-h-[1350px] mx-auto bg-white p-6 text-slate-900 select-none flex flex-col justify-between overflow-hidden"
      >
        {/* 1. TOP HEADER & SCOREBOARD & KPIS BLOCK */}
        <div>
          {/* 1.1 EDITORIAL FRIEZE */}
          <div className="flex items-center justify-between mb-2 font-mono text-[11px] text-slate-400">
            <span>{isEs ? 'LIGA 1 TE APUESTO · REPORTE DE PARTIDO' : 'LIGA 1 TE APUESTO · MATCH REPORT'}</span>
            <span>{isEs ? 'LÁMINA 02 / 03' : 'SHEET 02 / 03'}</span>
          </div>

          {/* 1.2 EDITORIAL TITLE & SUBTITLE */}
          <div className="mt-0.5 mb-3">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Build-up and penalty-area access
            </h1>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              The shape of the passing, the routes into the box and the possessions that reached a shot.
            </p>
          </div>

          {/* 1.3 SCOREBOARD CENTRAL (FILA 1 - ANCHO TOTAL 1080px) */}
          <div className="w-full flex items-center justify-between">
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

          {/* 1.4 FRISO DE KPIS SUPERIORES (4 COLUMNAS LIMPIAS) */}
          <div className="grid grid-cols-4 gap-6 pt-3 pb-4 mb-4 border-t border-b border-slate-100">
            {kpiItems.map((kpi) => {
              const maxVal = kpi.maxScale;
              const hBarPct = kpi.homeVal != null && maxVal > 0 ? Math.min(100, Math.max(0, (kpi.homeVal / maxVal) * 100)) : 0;
              const aBarPct = kpi.awayVal != null && maxVal > 0 ? Math.min(100, Math.max(0, (kpi.awayVal / maxVal) * 100)) : 0;

              return (
                <div key={kpi.id} className="flex flex-col justify-between">
                  <div className="text-[10px] font-mono tracking-wider text-slate-400 font-bold mb-2 uppercase">
                    {kpi.label}
                  </div>

                  <div className="space-y-1">
                    {/* Fila Local */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 truncate">
                        <span style={{ color: homeColor }}>■</span>
                        <span className="font-medium truncate">
                          {home_team.short_name || home_team.name}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: homeColor }}>
                        {kpi.format(kpi.homeVal)}
                      </span>
                    </div>

                    {/* Micro-barra Local */}
                    <div className="w-full h-[2px] bg-slate-100 overflow-hidden">
                      {hBarPct > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${hBarPct}%`, backgroundColor: homeColor }}
                        />
                      )}
                    </div>

                    {/* Fila Visitante */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 truncate">
                        <span style={{ color: awayColor }}>■</span>
                        <span className="font-medium truncate">
                          {away_team.short_name || away_team.name}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: awayColor }}>
                        {kpi.format(kpi.awayVal)}
                      </span>
                    </div>

                    {/* Micro-barra Visitante */}
                    <div className="w-full h-[2px] bg-slate-100 overflow-hidden mt-0.5">
                      {aBarPct > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${aBarPct}%`, backgroundColor: awayColor }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. ROW 1: MODULE 01 (HOME PASSING SHAPE) + MODULE 02 (AWAY PASSING SHAPE) */}
        <div className="grid grid-cols-2 gap-8 pb-4 mb-4 border-b border-slate-100">
          <PassingShapeModule
            moduleNumber="01"
            teamName={home_team.short_name || home_team.name}
            teamColor={homeColor}
            moduleData={module_01_home_passing_shape}
            lang={lang}
          />
          <PassingShapeModule
            moduleNumber="02"
            teamName={away_team.short_name || away_team.name}
            teamColor={awayColor}
            moduleData={module_02_away_passing_shape}
            lang={lang}
          />
        </div>

        {/* 3. ROW 2: MODULE 03 (HOME BOX ENTRIES) + MODULE 04 (AWAY BOX ENTRIES) */}
        <div className="grid grid-cols-2 gap-8 pb-4 mb-4 border-b border-slate-100">
          <BoxEntriesPitchModule
            moduleNumber="03"
            teamName={home_team.short_name || home_team.name}
            teamColor={homeColor}
            moduleData={module_03_home_box_entries}
            lang={lang}
          />
          <BoxEntriesPitchModule
            moduleNumber="04"
            teamName={away_team.short_name || away_team.name}
            teamColor={awayColor}
            moduleData={module_04_away_box_entries}
            lang={lang}
          />
        </div>

        {/* 4. ROW 3: MODULE 05 (NESTED POSSESSION STAGES) + MODULE 06 (ENTRY ORIGIN LANE) */}
        <div className="grid grid-cols-2 gap-8 pb-2 mb-2">
          <NestedPossessionStagesModule05
            moduleData={data.module_05_nested_possession_stages}
            homeColor={homeColor}
            awayColor={awayColor}
            areColorsSimilar={palette.areColorsSimilar}
            lang={lang}
          />
          <EntryOriginLaneModule06
            moduleData={data.module_06_entry_origin_lane}
            homeColor={homeColor}
            awayColor={awayColor}
            areColorsSimilar={palette.areColorsSimilar}
            lang={lang}
          />
        </div>

        {/* 3. EDITORIAL FOOTER */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono text-[10px] text-slate-400">
          <span>{isEs ? 'LIGA 1 SCOUT · PLATAFORMA DE INTELIGENCIA DEPORTIVA' : 'LIGA 1 SCOUT · SPORTS INTELLIGENCE PLATFORM'}</span>
          <span>{isEs ? 'INFORME GENERADO AUTOMÁTICAMENTE' : 'AUTOMATICALLY GENERATED REPORT'}</span>
        </div>
      </div>
    </div>
  );
};

export default MatchReportSheet02;
