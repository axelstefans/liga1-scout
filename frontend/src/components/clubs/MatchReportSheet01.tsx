import React, { useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useMatchSheet01Chances } from '../../hooks/useTeam';
import {
  MatchSheetModule01GoalItem,
  MatchSheetShotItem,
  MatchSheetXgFlowPoint,
} from '../../services/api';
import { getTeamCrestUrl, getTeamTricode } from '../../utils/teams';
import { ScoutingLang, useScoutingLanguage } from '../../i18n/scoutingReport';
import {
  ChanceBalanceModule02,
  ChanceToGoalModule05,
  FP_H,
  FP_LEFT,
  FP_TOP,
  FP_W,
  HalfPitchShotMapModule,
  ShotOutcomesModule06,
} from './MatchReportSheet01Modules';
import {
  EditorialTeamPalette,
  PlacedGoalLabel,
  SVG_FONT_MONO,
  SVG_FONT_SANS,
  computeGoalLabelLayout,
  computeNiceXgAxis,
  formatEditorialDate,
  formatNullableDecimal,
  formatNullableInt,
  getShotBubbleRadius,
  resolveEditorialTeamPalette,
} from './matchReportSheet01Utils';

export {
  computeGoalLabelLayout,
  formatEditorialDate,
  resolveEditorialTeamPalette,
} from './matchReportSheet01Utils';
export type { EditorialTeamPalette, PlacedGoalLabel } from './matchReportSheet01Utils';

export interface MatchReportSheet01Props {
  matchId: number | null;
}

export const MatchReportSheet01: React.FC<MatchReportSheet01Props> = ({ matchId }) => {
  // ALL HOOKS MUST RUN UNCONDITIONALLY AT THE TOP BEFORE ANY EARLY RETURN
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hoveredShot, setHoveredShot] = useState<MatchSheetShotItem | null>(null);
  const { lang, setLang, t } = useScoutingLanguage();
  const ms = t.matchSheet01;

  const { data, isLoading, isError, error, refetch } = useMatchSheet01Chances(
    matchId,
    Boolean(matchId)
  );

  const palette = useMemo<EditorialTeamPalette>(() => {
    if (!data?.home_team || !data?.away_team) {
      return { homeColor: '#0f172a', awayColor: '#0369a1', areColorsSimilar: false };
    }
    return resolveEditorialTeamPalette(
      data.home_team.team_id,
      data.home_team.name,
      data.away_team.team_id,
      data.away_team.name
    );
  }, [data]);

  const homeTri = useMemo(
    () => (data?.home_team ? getTeamTricode(data.home_team.team_id, data.home_team.name) : 'LOC'),
    [data]
  );
  const awayTri = useMemo(
    () => (data?.away_team ? getTeamTricode(data.away_team.team_id, data.away_team.name) : 'VIS'),
    [data]
  );

  const M01_W = 570;
  const M01_H = 224;
  const M01_PAD_L = 44;
  const M01_PAD_R = 126;
  const M01_PAD_T = 18;
  const M01_PAD_B = 36;
  const M01_PLOT_W = M01_W - M01_PAD_L - M01_PAD_R;
  const M01_PLOT_H = M01_H - M01_PAD_T - M01_PAD_B;

  const m01Points = useMemo<MatchSheetXgFlowPoint[]>(() => {
    if (!data) return [];
    if (data.module_01_xg_flow?.points?.length) return data.module_01_xg_flow.points;
    return Array.isArray(data.xg_flow) ? data.xg_flow : [];
  }, [data]);

  const m01Goals = useMemo<MatchSheetModule01GoalItem[]>(() => {
    if (!data?.module_01_xg_flow?.goals) return [];
    return data.module_01_xg_flow.goals;
  }, [data]);

  const m01MaxMin = useMemo(() => {
    const finalM = data?.final_minute ?? 90;
    const maxGoalM = m01Goals.reduce((acc, g) => {
      const eff = g.minute + (g.minute >= 90 && g.added_time ? g.added_time : 0);
      return Math.max(acc, eff);
    }, 90);
    return Math.max(90, finalM, maxGoalM);
  }, [data, m01Goals]);

  const m01YAxis = useMemo(() => {
    const maxPointXg = m01Points.reduce((acc, p) => Math.max(acc, p.home_xg, p.away_xg), 0);
    const maxGoalXg = m01Goals.reduce((acc, g) => Math.max(acc, g.cum_team_xg), 0);
    return computeNiceXgAxis(Math.max(maxPointXg, maxGoalXg));
  }, [m01Points, m01Goals]);

  const m01MaxY = m01YAxis.axisMax;

  const m01MinToX = (m: number) =>
    M01_PAD_L + (Math.min(m01MaxMin, Math.max(0, m)) / m01MaxMin) * M01_PLOT_W;
  const m01XgToY = (xg: number) =>
    M01_PAD_T + M01_PLOT_H - (Math.max(0, xg) / m01MaxY) * M01_PLOT_H;

  const {
    homeStepPath,
    awayStepPath,
    homeAreaPath,
    awayAreaPath,
    endHomeY,
    endAwayY,
    finalHomeXg,
    finalAwayXg,
  } = useMemo(() => {
    if (m01Points.length === 0) {
      const y0 = m01XgToY(0);
      return {
        homeStepPath: '',
        awayStepPath: '',
        homeAreaPath: '',
        awayAreaPath: '',
        endHomeY: y0,
        endAwayY: y0,
        finalHomeXg: 0,
        finalAwayXg: 0,
      };
    }
    const buildStepAndArea = (key: 'home_xg' | 'away_xg') => {
      const cmds: string[] = [];
      const baseY = m01XgToY(0);
      let prevY = baseY;
      cmds.push(`M ${m01MinToX(0).toFixed(1)} ${prevY.toFixed(1)}`);
      for (const pt of m01Points) {
        const x = m01MinToX(pt.minute);
        const y = m01XgToY(pt[key]);
        cmds.push(`L ${x.toFixed(1)} ${prevY.toFixed(1)}`);
        cmds.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
        prevY = y;
      }
      const endX = m01MinToX(m01MaxMin);
      cmds.push(`L ${endX.toFixed(1)} ${prevY.toFixed(1)}`);
      const stepPath = cmds.join(' ');
      const areaPath = `${stepPath} L ${endX.toFixed(1)} ${baseY.toFixed(1)} Z`;
      return { stepPath, areaPath };
    };
    const last = m01Points[m01Points.length - 1];
    let hEnd = m01XgToY(last.home_xg);
    let aEnd = m01XgToY(last.away_xg);
    if (Math.abs(hEnd - aEnd) < 11) {
      if (hEnd <= aEnd) {
        hEnd -= 5.5;
        aEnd += 5.5;
      } else {
        aEnd -= 5.5;
        hEnd += 5.5;
      }
    }
    const homePaths = buildStepAndArea('home_xg');
    const awayPaths = buildStepAndArea('away_xg');
    return {
      homeStepPath: homePaths.stepPath,
      awayStepPath: awayPaths.stepPath,
      homeAreaPath: homePaths.areaPath,
      awayAreaPath: awayPaths.areaPath,
      endHomeY: hEnd,
      endAwayY: aEnd,
      finalHomeXg: last.home_xg,
      finalAwayXg: last.away_xg,
    };
  }, [m01Points, m01MaxMin, m01MaxY]);

  const placedGoals = useMemo<PlacedGoalLabel[]>(() => {
    if (m01Goals.length === 0) return [];
    return computeGoalLabelLayout(
      m01Goals,
      m01MinToX,
      m01XgToY,
      {
        left: M01_PAD_L,
        right: M01_PAD_L + M01_PLOT_W,
        top: M01_PAD_T,
        bottom: M01_PAD_T + M01_PLOT_H,
      },
      { ownGoalTag: ms.module01.ownGoalTag, penTag: ms.module01.penTag }
    );
  }, [m01Goals, m01MaxMin, m01MaxY, ms.module01.ownGoalTag, ms.module01.penTag]);

  const mappedHomeShots = useMemo(() => {
    const raw = data?.module_03_home_shots?.shots ?? [];
    return [...raw]
      .sort((a, b) => (a.is_goal === b.is_goal ? a.xg - b.xg : a.is_goal ? 1 : -1))
      .map((s) => ({
        shot: s,
        px: FP_LEFT + (Math.max(0, Math.min(100, s.raw_x ?? s.x)) / 100) * FP_W,
        py: FP_TOP + (Math.max(0, Math.min(100, s.y)) / 100) * FP_H,
        r: getShotBubbleRadius(s.xg),
      }));
  }, [data]);

  const mappedAwayShots = useMemo(() => {
    const raw = data?.module_04_away_shots?.shots ?? [];
    return [...raw]
      .sort((a, b) => (a.is_goal === b.is_goal ? a.xg - b.xg : a.is_goal ? 1 : -1))
      .map((s) => ({
        shot: s,
        px: FP_LEFT + (Math.max(0, Math.min(100, s.raw_x ?? s.x)) / 100) * FP_W,
        py: FP_TOP + (Math.max(0, Math.min(100, s.y)) / 100) * FP_H,
        r: getShotBubbleRadius(s.xg),
      }));
  }, [data]);

  const handleExportPNG = async () => {
    const node = sheetRef.current;
    if (!node || !data || isExporting) return;

    try {
      setIsExporting(true);

      // 1. Garantizar carga previa de fuentes tipográficas y escudos/imágenes
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
        pixelRatio: 1, // CRÍTICO: fijar en 1 para evitar que la librería vuelva a multiplicar canvasWidth
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

      // 4. Nombre canónico editorial: MatchReport_Sheet01_{HomeTeam}_{AwayTeam}_{Fecha}.png
      const sanitize = (val: string) => val.trim().replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '');
      const homeTeamStr = sanitize(data.home_team.short_name || data.home_team.name || homeTri);
      const awayTeamStr = sanitize(data.away_team.short_name || data.away_team.name || awayTri);
      const dateStr = data.match_date ? data.match_date.slice(0, 10) : String(data.match_id);

      const link = document.createElement('a');
      link.download = `MatchReport_Sheet01_${homeTeamStr}_${awayTeamStr}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting Match Report Sheet 01 PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // EARLY RETURNS (AFTER ALL HOOKS)
  if (!matchId) {
    return (
      <div className="bg-white border border-slate-200 p-10 text-center text-slate-500 font-mono text-xs uppercase tracking-widest">
        {ms.footer.selectMatchPrompt}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 p-14 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-slate-700" />
        <span className="font-mono text-xs uppercase tracking-widest">{ms.footer.loadingSheet}</span>
      </div>
    );
  }
  if (isError || !data || !data.home_team || !data.away_team) {
    return (
      <div className="bg-white border border-slate-300 p-8 flex flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="w-6 h-6 text-rose-600" />
        <div className="text-sm font-semibold text-slate-900">{ms.footer.errorTitle}</div>
        <p className="text-xs text-slate-500 max-w-md font-mono">
          {error instanceof Error ? error.message : 'Error'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {ms.footer.retryButton}
        </button>
      </div>
    );
  }

  const {
    home_team,
    away_team,
    metrics,
    scoreboard_kpis,
    module_01_xg_flow,
    module_02_chance_balance,
    module_03_home_shots,
    module_04_away_shots,
    module_05_chance_to_goal,
    module_06_shot_outcomes,
  } = data;
  const { homeColor, awayColor, areColorsSimilar } = palette;
  const formattedDate = formatEditorialDate(data.match_date, ms.months);

  const kpiHome = scoreboard_kpis?.home ?? {
    xg: metrics?.home?.xg ?? null,
    xgot: data.has_xgot ? (metrics?.home?.xgot ?? null) : null,
    shots: metrics?.home?.shots_total ?? null,
    on_target: metrics?.home?.shots_on_target ?? null,
  };
  const kpiAway = scoreboard_kpis?.away ?? {
    xg: metrics?.away?.xg ?? null,
    xgot: data.has_xgot ? (metrics?.away?.xgot ?? null) : null,
    shots: metrics?.away?.shots_total ?? null,
    on_target: metrics?.away?.shots_on_target ?? null,
  };

  const kpiItems = [
    { id: 'xg', label: ms.kpis.xg.label, sublabel: ms.kpis.xg.sublabel, homeVal: kpiHome.xg, awayVal: kpiAway.xg, format: (v: number | null) => formatNullableDecimal(v, 2) },
    { id: 'xgot', label: ms.kpis.xgot.label, sublabel: ms.kpis.xgot.sublabel, homeVal: kpiHome.xgot, awayVal: kpiAway.xgot, format: (v: number | null) => formatNullableDecimal(v, 2) },
    { id: 'shots', label: ms.kpis.shots.label, sublabel: ms.kpis.shots.sublabel, homeVal: kpiHome.shots, awayVal: kpiAway.shots, format: (v: number | null) => formatNullableInt(v) },
    { id: 'sot', label: ms.kpis.onTarget.label, sublabel: ms.kpis.onTarget.sublabel, homeVal: kpiHome.on_target, awayVal: kpiAway.on_target, format: (v: number | null) => formatNullableInt(v) },
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
          <span>{isExporting ? ms.footer.exportingButton : ms.footer.exportButton}</span>
        </button>
      </div>

      {/* SINGLE EDITORIAL CANVAS (1080px fixed layout, no rounded-xl/shadow-sm) */}
      <div
        ref={sheetRef}
        className="w-[1080px] max-w-[1080px] min-w-[1080px] h-[1350px] min-h-[1350px] max-h-[1350px] mx-auto bg-white p-6 text-slate-900 select-none flex flex-col justify-between overflow-hidden"
      >
        {/* 1. TOP HEADER & SCOREBOARD & KPIS BLOCK */}
        <div>
          {/* 1.1 EDITORIAL FRIEZE */}
          <div className="flex items-center justify-between mb-2 font-mono text-[11px] text-slate-400">
            <span>{ms.friezeLeft}</span>
            <span>{ms.friezeRight}</span>
          </div>

          {/* 1.2 EDITORIAL TITLE & SUBTITLE */}
          <div className="mt-0.5 mb-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {ms.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {ms.conceptualSubtitle}
            </p>
          </div>

          {/* 1.3 SCOREBOARD CENTRAL (FILA 1 - ANCHO TOTAL 1080px) */}
          <div className="w-full flex items-center justify-between">
            {/* Extrema izquierda: Escudo Local + Nombre corto en negrita */}
            <div className="flex items-center gap-3 flex-1 justify-start min-w-0">
              <img
                src={getTeamCrestUrl(home_team.team_id, home_team.logo_url)}
                alt={home_team.name}
                className="w-9 h-9 object-contain shrink-0"
              />
              <span className="text-lg font-bold text-slate-900 truncate">
                {home_team.short_name || home_team.name}
              </span>
            </div>

            {/* Centro exacto: Marcador grande y debajo centrado {tournament} · {date} */}
            <div className="flex flex-col items-center justify-center shrink-0 px-8">
              <div className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums whitespace-nowrap">
                {home_team.score} – {away_team.score}
              </div>
              <div className="text-center font-mono text-[11px] text-slate-400 mt-0.5">
                {[data.tournament, formattedDate].filter(Boolean).join(' · ')}
              </div>
            </div>

            {/* Extrema derecha: Nombre corto Visitante en negrita + Escudo Visitante */}
            <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
              <span className="text-lg font-bold text-slate-900 text-right truncate">
                {away_team.short_name || away_team.name}
              </span>
              <img
                src={getTeamCrestUrl(away_team.team_id, away_team.logo_url)}
                alt={away_team.name}
                className="w-9 h-9 object-contain shrink-0"
              />
            </div>
          </div>

          {/* 1.4 FILA DE LOS 4 KPIS (FILA 2 - 4 COLUMNAS IGUALES A ANCHO TOTAL) */}
          <div className="grid grid-cols-4 gap-4 mt-2.5 pt-2.5 border-t border-slate-100 pb-3 mb-3 border-b border-slate-100">
            {kpiItems.map((kpi) => {
              const hVal = kpi.homeVal;
              const aVal = kpi.awayVal;
              const hHas = hVal !== null && hVal !== undefined;
              const aHas = aVal !== null && aVal !== undefined;
              const hNum = hHas ? Number(hVal) : 0;
              const aNum = aHas ? Number(aVal) : 0;
              const kpiMax = Math.max(hNum, aNum, 0.001);
              const hBarPct = hHas && hNum > 0 ? Math.min(100, (hNum / kpiMax) * 100) : 0;
              const aBarPct = aHas && aNum > 0 ? Math.min(100, (aNum / kpiMax) * 100) : 0;

              return (
                <div key={kpi.id} className="flex flex-col justify-between">
                  <div className="text-[10px] font-mono tracking-wider text-slate-400 font-bold uppercase mb-1.5">
                    {kpi.label}
                  </div>

                  <div className="font-mono">
                    {/* 1. Fila Local */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 truncate">
                        <span style={{ color: homeColor }}>•</span>
                        <span className="font-medium truncate">
                          {home_team.short_name || home_team.name}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: homeColor }}>
                        {kpi.format(kpi.homeVal)}
                      </span>
                    </div>

                    {/* 2. Micro-barra Local */}
                    <div className="w-full h-[2px] bg-slate-100 overflow-hidden mb-1.5 mt-0.5">
                      {hBarPct > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${hBarPct}%`, backgroundColor: homeColor }}
                        />
                      )}
                    </div>

                    {/* 3. Fila Visitante */}
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

                    {/* 4. Micro-barra Visitante */}
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

        {/* ROW 1: MODULE 01 (xG FLOW) + MODULE 02 (CHANCE BALANCE) */}
        <div className="grid grid-cols-12 gap-6 pb-3 mb-3 border-b border-slate-100">
          <div className="col-span-7 pr-6 border-r border-slate-200 flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-200 pb-2 mb-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {ms.module01.number}
                  </span>
                  <h2 className="text-xs font-bold tracking-[0.04em] text-slate-900">
                    {ms.module01.editorialTitle}
                  </h2>
                </div>
                <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                  {ms.module01.editorialSubtitle}
                </p>
              </div>

              {!module_01_xg_flow || m01Points.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center font-mono text-xs text-slate-400">
                  — {ms.module01.empty} —
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${M01_W} ${M01_H}`}
                  className="w-full h-auto block select-none"
                >
                  {/* Stoppage time band (>90') */}
                  {m01MaxMin > 90 && (
                    <rect
                      x={m01MinToX(90)}
                      y={M01_PAD_T}
                      width={M01_PAD_L + M01_PLOT_W - m01MinToX(90)}
                      height={M01_PLOT_H}
                      fill="#f8fafc"
                    />
                  )}

                  {/* Y-axis ticks & gridlines (continuous subtle gray slate-100) */}
                  {m01YAxis.ticks.map((val) => {
                    const y = m01XgToY(val);
                    return (
                      <g key={`ygrid-${val}`}>
                        <line x1={M01_PAD_L} y1={y} x2={M01_PAD_L + M01_PLOT_W} y2={y} stroke={val === 0 ? '#cbd5e1' : '#f1f5f9'} strokeWidth="1" />
                        <text
                          x={M01_PAD_L - 6}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="9.5"
                          fontFamily={SVG_FONT_MONO}
                          fontWeight="500"
                          className="font-mono text-[9.5px] fill-slate-500"
                        >
                          {val.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Vertical Y-axis Title: Cumulative xG */}
                  <text
                    x={13}
                    y={M01_PAD_T + M01_PLOT_H / 2}
                    textAnchor="middle"
                    transform={`rotate(-90 13 ${M01_PAD_T + M01_PLOT_H / 2})`}
                    fontSize="9.5"
                    fontFamily={SVG_FONT_SANS}
                    fontWeight="600"
                    className="font-mono text-[9.5px] font-semibold fill-slate-600"
                  >
                    {ms.module01.yAxisLabel}
                  </text>

                  {/* X-axis ticks: 0, 20, 40, 60, 80 (+ 90 when match exceeds 80) */}
                  {[0, 20, 40, 60, 80, ...(m01MaxMin > 80 ? [90] : [])].map((minTick) => {
                    const x = m01MinToX(minTick);
                    return (
                      <g key={`xtick-${minTick}`}>
                        <line x1={x} y1={M01_PAD_T} x2={x} y2={M01_PAD_T + M01_PLOT_H} stroke={minTick === 90 ? '#cbd5e1' : '#f1f5f9'} strokeWidth={minTick === 90 ? '1' : '0.8'} strokeDasharray={minTick === 90 ? '3 2' : undefined} />
                        <text
                          x={x}
                          y={M01_PAD_T + M01_PLOT_H + 13}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontFamily={SVG_FONT_MONO}
                          fontWeight="500"
                          className="font-mono text-[9.5px] fill-slate-500"
                        >
                          {minTick}
                        </text>
                      </g>
                    );
                  })}

                  {/* Stoppage time label at right edge when m01MaxMin > 90 */}
                  {m01MaxMin > 90 && (
                    <text
                      x={M01_PAD_L + M01_PLOT_W}
                      y={M01_PAD_T + M01_PLOT_H + 13}
                      textAnchor="end"
                      fontSize="9"
                      fontFamily={SVG_FONT_SANS}
                      fontWeight="600"
                      className="font-mono text-[9px] fill-slate-500 font-semibold"
                    >
                      +{m01MaxMin - 90}&apos; {ms.module01.stoppageSuffix}
                    </text>
                  )}

                  {/* X-axis Title: Elapsed minute */}
                  <text
                    x={M01_PAD_L + M01_PLOT_W / 2}
                    y={M01_H - 4}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily={SVG_FONT_SANS}
                    fontWeight="600"
                    className="font-mono text-[9.5px] font-semibold fill-slate-600"
                  >
                    {ms.module01.xAxisLabel}
                  </text>

                  {/* Translucent step area fills underneath contour curves */}
                  <path d={homeAreaPath} fill={homeColor} fillOpacity="0.08" stroke="none" />
                  <path d={awayAreaPath} fill={awayColor} fillOpacity="0.08" stroke="none" />

                  {/* Step curves */}
                  <path d={homeStepPath} fill="none" stroke={homeColor} strokeWidth="2.5" />
                  <path
                    d={awayStepPath}
                    fill="none"
                    stroke={awayColor}
                    strokeWidth="2.5"
                    strokeDasharray={areColorsSimilar ? '6 3' : undefined}
                  />

                  {/* Team names & final xG at right end without clipping (M01_PAD_R = 126) */}
                  <text
                    x={M01_PAD_L + M01_PLOT_W + 8}
                    y={endHomeY + 3}
                    fontSize="9.5"
                    fontFamily={SVG_FONT_MONO}
                    fontWeight="700"
                    className="font-mono text-[9px] font-bold"
                    fill={homeColor}
                  >
                    {home_team.short_name || home_team.name || homeTri} {finalHomeXg.toFixed(2)}
                  </text>
                  <text
                    x={M01_PAD_L + M01_PLOT_W + 8}
                    y={endAwayY + 3}
                    fontSize="9.5"
                    fontFamily={SVG_FONT_MONO}
                    fontWeight="700"
                    className="font-mono text-[9px] font-bold"
                    fill={awayColor}
                  >
                    {away_team.short_name || away_team.name || awayTri} {finalAwayXg.toFixed(2)}
                  </text>

                  {/* Goal circles & minute-only labels anchored at the step */}
                  {placedGoals.map((pg, idx) => {
                    const color = pg.goal.is_home ? homeColor : awayColor;
                    return (
                      <g key={`goal-${idx}-${pg.goal.minute}-${pg.goal.player_name}`}>
                        <circle
                          cx={pg.gx}
                          cy={pg.gy}
                          r="4"
                          fill={pg.goal.is_home || !areColorsSimilar ? color : '#ffffff'}
                          stroke={color}
                          strokeWidth="1.8"
                        />
                        <text
                          x={pg.lx}
                          y={pg.ly}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontFamily={SVG_FONT_MONO}
                          fontWeight="700"
                          className="font-mono text-[9.5px] font-bold"
                          fill="#0f172a"
                          stroke="#ffffff"
                          strokeWidth="2.8"
                          paintOrder="stroke"
                        >
                          {pg.labelText}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          <ChanceBalanceModule02
            matchId={data.match_id}
            module02={module_02_chance_balance}
            homeColor={homeColor}
            awayColor={awayColor}
            ms={ms}
          />
        </div>

        {/* ROW 2: MODULE 03 (HOME SHOT MAP) + MODULE 04 (AWAY SHOT MAP) */}
        <div className="grid grid-cols-12 gap-6 pb-3 mb-3 border-b border-slate-100">
          <HalfPitchShotMapModule
            matchId={data.match_id}
            moduleNumber={ms.module0304.homeNumber}
            teamName={home_team.name}
            teamTri={homeTri}
            teamColor={homeColor}
            isAwayModule={false}
            areColorsSimilar={areColorsSimilar}
            moduleData={module_03_home_shots}
            mappedShots={mappedHomeShots}
            ms={ms}
            onHoverShot={setHoveredShot}
          />
          <HalfPitchShotMapModule
            matchId={data.match_id}
            moduleNumber={ms.module0304.awayNumber}
            teamName={away_team.name}
            teamTri={awayTri}
            teamColor={awayColor}
            isAwayModule={true}
            areColorsSimilar={areColorsSimilar}
            moduleData={module_04_away_shots}
            mappedShots={mappedAwayShots}
            ms={ms}
            onHoverShot={setHoveredShot}
          />
        </div>

        {hoveredShot && (
          <div className="mb-4 px-3 py-1.5 border border-slate-200 bg-slate-50 font-mono text-[11px] flex items-center justify-between export-ignore">
            <span>
              <strong>{hoveredShot.player}</strong> ({hoveredShot.minute}&apos;) ·{' '}
              {hoveredShot.outcome.toUpperCase()}
              {hoveredShot.from_own_half ? " [x'=50 own half]" : ''}
            </span>
            <span>
              xG: <strong>{hoveredShot.xg.toFixed(3)}</strong> · Dist: {hoveredShot.distance_m}m
            </span>
          </div>
        )}

        {/* ROW 3: MODULE 05 (FROM CHANCE TO GOAL) + MODULE 06 (SHOT OUTCOMES) */}
        <div className="grid grid-cols-12 gap-6 pb-2 mb-2">
          <ChanceToGoalModule05
            m05Home={module_05_chance_to_goal?.home ?? null}
            m05Away={module_05_chance_to_goal?.away ?? null}
            hasXgot={data.has_xgot}
            homeColor={homeColor}
            awayColor={awayColor}
            areColorsSimilar={areColorsSimilar}
            ms={ms}
          />
          <ShotOutcomesModule06
            m06Home={module_06_shot_outcomes?.home ?? null}
            m06Away={module_06_shot_outcomes?.away ?? null}
            homeTri={homeTri}
            awayTri={awayTri}
            homeColor={homeColor}
            awayColor={awayColor}
            areColorsSimilar={areColorsSimilar}
            ms={ms}
          />
        </div>

        {/* EDITORIAL FOOTER */}
        <div className="pt-2 border-t border-slate-100 mt-1">
          <div className="flex items-center justify-between pb-2">
            {/* Left: Logo and institutional isotype with "LIGA 1 SCOUT" */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-900 text-white font-mono font-black text-[9px] flex items-center justify-center tracking-tighter">
                L1
              </div>
              <span className="font-mono font-black tracking-[0.14em] text-xs text-slate-900">
                LIGA 1 SCOUT
              </span>
            </div>

            {/* Right: Technical text */}
            <span className="font-mono text-[10px] text-slate-400 font-normal">
              {ms.footer.modelEstimates || 'Local model values are estimates'}
            </span>
          </div>

          {/* Absolute base: Thin 2px dual-color bar hugging bottom canvas edge */}
          <div className="-mx-6 -mb-6 h-[2px] flex">
            <div className="w-1/2 h-full" style={{ backgroundColor: homeColor }} />
            <div className="w-1/2 h-full" style={{ backgroundColor: awayColor }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchReportSheet01;
