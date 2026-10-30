import React, { useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useMatchSheet01Chances } from '../../hooks/useTeam';
import { MatchSheetShotItem, MatchSheetXgFlowPoint } from '../../services/api';
import { getTeamCrestUrl, getTeamThemeColor, getTeamTricode } from '../../utils/teams';

export interface MatchReportSheet01Props {
  matchId: number | null;
}

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function formatEditorialDate(isoDate?: string | null): string {
  if (!isoDate) return '';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = MONTHS_ES[monthIdx] || parts[1];
  return `${day} ${monthName} ${year}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [15, 23, 42];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function colorDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function resolveDistinctMatchColors(
  homeId: number,
  homeName: string,
  awayId: number,
  awayName: string
): { homeColor: string; awayColor: string } {
  const rawHome = getTeamThemeColor(homeName, null, homeId) || '#0f172a';
  let rawAway = getTeamThemeColor(awayName, null, awayId) || '#0284c7';

  if (colorDistance(rawHome, rawAway) < 85) {
    rawAway = colorDistance(rawHome, '#0f172a') > 110 ? '#0f172a' : '#0284c7';
  }
  return { homeColor: rawHome, awayColor: rawAway };
}

function formatShortPlayerName(fullName: string | null): string {
  if (!fullName) return '';
  const clean = fullName.replace(/\s*\(AG\)\s*$/, '').trim();
  const isOg = fullName.includes('(AG)');
  if (clean.includes(',')) {
    const [surname, first] = clean.split(',').map((s) => s.trim());
    const init = first ? `${first.charAt(0).toUpperCase()}. ` : '';
    return `${init}${surname}${isOg ? ' (AG)' : ''}`;
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return `${parts[0]}${isOg ? ' (AG)' : ''}`;
  const init = parts[0].charAt(0).toUpperCase();
  const surname = parts[parts.length - 1];
  return `${init}. ${surname}${isOg ? ' (AG)' : ''}`;
}

function getShotBubbleRadius(xg: number): number {
  return Math.max(4.5, Math.min(15.5, Math.sqrt(Math.max(0.01, xg)) * 22));
}

function buildStarPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

function formatNullableDecimal(val: number | null | undefined, decimals: number = 2): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return val.toFixed(decimals);
}

function formatNullableInt(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return String(Math.round(val));
}

const RESULT_LABELS: Record<string, string> = {
  goal: 'Gol',
  saved: 'Atajado',
  miss: 'Desviado',
  blocked: 'Bloqueado',
};

const SITUATION_LABELS: Record<string, string> = {
  open_play: 'Jugada abierta',
  set_piece: 'Balón parado',
  corner: 'Tiro de esquina',
  penalty: 'Penal',
  fast_break: 'Contraataque',
};

const BODY_PART_LABELS: Record<string, string> = {
  right_foot: 'Pie derecho',
  left_foot: 'Pie izquierdo',
  head: 'Cabeza',
  other: 'Otro',
};

// Constants for Mirrored Horizontal Shot Maps Geometry
const MAP_W = 980;
const MAP_H = 340;
const HALF_W = 440;
const PITCH_TOP = 24;
const PITCH_H = 292;
const LEFT_GOAL_X = 28;
const LEFT_MID_X = LEFT_GOAL_X + HALF_W; // 468
const RIGHT_MID_X = 512;
const RIGHT_GOAL_X = RIGHT_MID_X + HALF_W; // 952
const BOX_W = 138.3;
const BOX_H = 173.1;
const BOX_Y = PITCH_TOP + (PITCH_H - BOX_H) / 2;
const SIX_W = 46.1;
const SIX_H = 78.7;
const SIX_Y = PITCH_TOP + (PITCH_H - SIX_H) / 2;
const PEN_SPOT_DX = 92.2;
const CENTER_Y = PITCH_TOP + PITCH_H / 2;
const GOAL_H = 34;
const GOAL_Y = CENTER_Y - GOAL_H / 2;

export const MatchReportSheet01: React.FC<MatchReportSheet01Props> = ({ matchId }) => {
  // =========================================================================
  // ALL HOOKS MUST RUN UNCONDITIONALLY BEFORE ANY EARLY RETURN
  // =========================================================================
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hoveredShot, setHoveredShot] = useState<MatchSheetShotItem | null>(null);
  const [hoveredGoal, setHoveredGoal] = useState<MatchSheetXgFlowPoint | null>(null);

  const { data, isLoading, isError, error, refetch } = useMatchSheet01Chances(
    matchId,
    Boolean(matchId)
  );

  const { homeColor, awayColor } = useMemo(() => {
    if (!data?.home_team || !data?.away_team) {
      return { homeColor: '#0f172a', awayColor: '#0284c7' };
    }
    return resolveDistinctMatchColors(
      data.home_team.team_id,
      data.home_team.name,
      data.away_team.team_id,
      data.away_team.name
    );
  }, [data]);

  // Map Home shots onto Left Half-Pitch (Goal at LEFT_GOAL_X)
  const mappedHomeShots = useMemo(() => {
    const rawHomeShots = data?.shots?.home ?? [];
    const order: Record<string, number> = { blocked: 1, miss: 2, saved: 3, goal: 4 };
    return [...rawHomeShots]
      .sort((a, b) => (order[a.result] || 0) - (order[b.result] || 0))
      .map((s) => {
        const clampedX = Math.max(50, Math.min(100, s.x));
        const clampedY = Math.max(2, Math.min(98, s.y));
        const distFromGoalRatio = (100 - clampedX) / 50;
        const r = getShotBubbleRadius(s.xg);
        const px = LEFT_GOAL_X + Math.max(r + 1, Math.min(HALF_W - r - 1, distFromGoalRatio * HALF_W));
        const py = PITCH_TOP + (clampedY / 100) * PITCH_H;
        return { shot: s, px, py, r };
      });
  }, [data?.shots?.home]);

  // Map Away shots onto Right Half-Pitch (Goal at RIGHT_GOAL_X, mirrored across center line)
  const mappedAwayShots = useMemo(() => {
    const rawAwayShots = data?.shots?.away ?? [];
    const order: Record<string, number> = { blocked: 1, miss: 2, saved: 3, goal: 4 };
    return [...rawAwayShots]
      .sort((a, b) => (order[a.result] || 0) - (order[b.result] || 0))
      .map((s) => {
        const clampedX = Math.max(50, Math.min(100, s.x));
        const clampedY = Math.max(2, Math.min(98, s.y));
        const distFromGoalRatio = (100 - clampedX) / 50;
        const r = getShotBubbleRadius(s.xg);
        const px = RIGHT_GOAL_X - Math.max(r + 1, Math.min(HALF_W - r - 1, distFromGoalRatio * HALF_W));
        const py = PITCH_TOP + ((100 - clampedY) / 100) * PITCH_H;
        return { shot: s, px, py, r };
      });
  }, [data?.shots?.away]);

  const handleExportPNG = async () => {
    if (!sheetRef.current || isExporting || !data) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(sheetRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        },
      });
      const link = document.createElement('a');
      const hTri = getTeamTricode(data.home_team.team_id, data.home_team.name).toLowerCase();
      const aTri = getTeamTricode(data.away_team.team_id, data.away_team.name).toLowerCase();
      link.download = `lamina-01-resultado-ocasiones-${hTri}-vs-${aTri}-m${data.match_id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting Match Report Sheet 01 PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // GUARD CLAUSES (STRICTLY AFTER ALL HOOKS)
  // =========================================================================
  if (!matchId) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-xs">
        Selecciona un partido jugado en el selector superior para visualizar la Lámina 01 / 04.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-28 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2.5" />
        <span className="text-xs font-medium text-slate-500 tracking-wide">
          Construyendo Lámina 01 / 04 — Resultado y Ocasiones...
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-rose-50/70 border border-rose-200 rounded-xl py-16 px-4 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
        <p className="text-xs font-semibold text-rose-900 mb-1">
          Error al consultar el reporte del partido seleccionado
        </p>
        <p className="text-xs text-rose-700 max-w-md mb-3">
          {error instanceof Error ? error.message : 'Fallo en la petición al servidor.'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-16 px-4 text-center text-xs text-slate-500">
        No se registran datos tácticos para el partido seleccionado.
      </div>
    );
  }

  const { home_team, away_team, metrics, has_xgot, final_minute } = data;
  const xgFlowList = data.xg_flow ?? [];
  const mHome = metrics.home;
  const mAway = metrics.away;

  // 4 Header Scoreboard KPI blocks
  const secondKpiHome = has_xgot && mHome.xgot !== null ? mHome.xgot : mHome.npxg;
  const secondKpiAway = has_xgot && mAway.xgot !== null ? mAway.xgot : mAway.npxg;

  const headerKpis = [
    {
      id: 'xg',
      label: 'EXPECTED GOALS (xG)',
      sublabel: 'Calidad acumulada',
      homeVal: mHome.xg,
      awayVal: mAway.xg,
      format: (v: number | null | undefined) => formatNullableDecimal(v, 2),
    },
    {
      id: 'xgot',
      label: 'EXPECTED GOALS ON TARGET (xGOT)',
      sublabel: has_xgot ? 'Calidad post-remate (Flashscore)' : 'Fallback: Non-Penalty xG (npxG)',
      homeVal: secondKpiHome,
      awayVal: secondKpiAway,
      format: (v: number | null | undefined) => formatNullableDecimal(v, 2),
    },
    {
      id: 'shots',
      label: 'SHOTS',
      sublabel: 'Tiros totales',
      homeVal: mHome.shots_total,
      awayVal: mAway.shots_total,
      format: (v: number | null | undefined) => formatNullableInt(v),
    },
    {
      id: 'on_target',
      label: 'ON TARGET',
      sublabel: 'Tiros al arco',
      homeVal: mHome.shots_on_target,
      awayVal: mAway.shots_on_target,
      format: (v: number | null | undefined) => formatNullableInt(v),
    },
  ];

  // Bidirectional Chance Balance rows
  const chanceBalanceRows = [
    {
      key: 'goals',
      label: 'Goles',
      homeVal: mHome.goals,
      awayVal: mAway.goals,
      format: (v: number | null | undefined) => formatNullableInt(v),
    },
    {
      key: 'xg_per_shot',
      label: 'xG por tiro',
      homeVal: mHome.xg_per_shot,
      awayVal: mAway.xg_per_shot,
      format: (v: number | null | undefined) => formatNullableDecimal(v, 2),
    },
    {
      key: 'big_chances',
      label: 'Big chances',
      homeVal: mHome.big_chances,
      awayVal: mAway.big_chances,
      format: (v: number | null | undefined) => formatNullableInt(v),
    },
    {
      key: 'inside_box',
      label: 'Tiros dentro del área',
      homeVal: mHome.shots_inside_box,
      awayVal: mAway.shots_inside_box,
      format: (v: number | null | undefined) => formatNullableInt(v),
    },
    {
      key: 'outside_box',
      label: 'Tiros fuera del área',
      homeVal: mHome.shots_outside_box,
      awayVal: mAway.shots_outside_box,
      format: (v: number | null | undefined) => formatNullableInt(v),
    },
  ];

  // =========================================================================
  // xG FLOW STEP CHART GEOMETRY
  // =========================================================================
  const FLOW_W = 640;
  const FLOW_H = 265;
  const FLOW_PAD_L = 44;
  const FLOW_PAD_R = 46;
  const FLOW_PAD_T = 24;
  const FLOW_PAD_B = 34;
  const FLOW_PLOT_W = FLOW_W - FLOW_PAD_L - FLOW_PAD_R;
  const FLOW_PLOT_H = FLOW_H - FLOW_PAD_T - FLOW_PAD_B;

  const maxMinute = Math.max(90, final_minute || 90);
  const rawMaxXg = Math.max(
    1.2,
    mHome.xg ?? 0,
    mAway.xg ?? 0,
    ...xgFlowList.map((p) => Math.max(p.home_xg ?? 0, p.away_xg ?? 0))
  );
  const yMaxXg = Math.ceil((rawMaxXg + 0.25) * 2) / 2;

  const minToX = (m: number) =>
    FLOW_PAD_L + (Math.max(0, Math.min(maxMinute, m)) / maxMinute) * FLOW_PLOT_W;
  const xgToY = (xg: number) =>
    FLOW_PAD_T + FLOW_PLOT_H - (Math.max(0, Math.min(yMaxXg, xg)) / yMaxXg) * FLOW_PLOT_H;

  // Build step SVG path and area path
  const buildStepPaths = (side: 'home' | 'away') => {
    if (xgFlowList.length === 0) return { linePath: '', areaPath: '' };
    const pts = xgFlowList.map((p) => ({
      x: minToX(p.minute),
      y: xgToY(side === 'home' ? p.home_xg : p.away_xg),
    }));
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` H ${pts[i].x.toFixed(1)} V ${pts[i].y.toFixed(1)}`;
    }
    const baselineY = (FLOW_PAD_T + FLOW_PLOT_H).toFixed(1);
    const area = `${d} V ${baselineY} H ${pts[0].x.toFixed(1)} Z`;
    return { linePath: d, areaPath: area };
  };

  const homeStep = buildStepPaths('home');
  const awayStep = buildStepPaths('away');

  const goalEvents = xgFlowList.filter(
    (p) => p.event_type === 'goal' || p.event_type === 'own_goal'
  );

  const yTicks: number[] = [];
  const tickStep = yMaxXg <= 2.0 ? 0.5 : 1.0;
  for (let v = 0; v <= yMaxXg + 0.001; v += tickStep) {
    yTicks.push(Number(v.toFixed(1)));
  }

  const xMinuteTicks = [0, 15, 30, 45, 60, 75, 90];
  if (maxMinute > 92) {
    xMinuteTicks.push(maxMinute);
  }

  const renderShotMarker = (
    item: { shot: MatchSheetShotItem; px: number; py: number; r: number },
    teamColor: string
  ) => {
    const { shot, px, py, r } = item;
    const isHovered = hoveredShot?.shot_id === shot.shot_id;
    const radius = isHovered ? r * 1.22 : r;

    return (
      <g
        key={shot.shot_id}
        className="cursor-pointer"
        onMouseEnter={() => setHoveredShot(shot)}
        onMouseLeave={() => setHoveredShot(null)}
      >
        {shot.result === 'goal' ? (
          <g>
            <circle
              cx={px}
              cy={py}
              r={Math.max(6.5, radius + 2)}
              fill="#ffffff"
              stroke={teamColor}
              strokeWidth={1.6}
            />
            <circle
              cx={px}
              cy={py}
              r={Math.max(5.2, radius)}
              fill={teamColor}
              fillOpacity={0.96}
              stroke="#0f172a"
              strokeWidth={1.6}
            />
            <polygon
              points={buildStarPoints(
                px,
                py,
                Math.max(3.2, radius * 0.56),
                Math.max(1.5, radius * 0.25)
              )}
              fill="#ffffff"
            />
          </g>
        ) : shot.result === 'saved' ? (
          <circle
            cx={px}
            cy={py}
            r={radius}
            fill={teamColor}
            fillOpacity={0.55}
            stroke={teamColor}
            strokeWidth={1.8}
          />
        ) : shot.result === 'miss' ? (
          <circle
            cx={px}
            cy={py}
            r={radius}
            fill="#ffffff"
            fillOpacity={0.88}
            stroke={teamColor}
            strokeWidth={1.6}
          />
        ) : (
          <circle
            cx={px}
            cy={py}
            r={radius}
            fill="#cbd5e1"
            fillOpacity={0.7}
            stroke="#475569"
            strokeWidth={1.3}
            strokeDasharray="2.5 1.5"
          />
        )}
      </g>
    );
  };

  return (
    <div
      ref={sheetRef}
      className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden p-5 sm:p-6 space-y-5 select-none"
    >
      {/* =================================================================== */}
      {/* TOP EDITORIAL SERIAL STRIP                                          */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            LÁMINA 01 / 04
          </span>
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.12em] text-slate-900">
              Resultado y Ocasiones
            </h2>
            <p className="text-[11px] text-slate-500 font-normal">
              Evolución de goles esperados (xG), balance de peligro y localización de remates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono text-[11px] text-slate-500 uppercase tracking-wider">
            <span>{data.season}</span>
            <span className="mx-1.5 text-slate-300">•</span>
            <span>{data.tournament}</span>
            {data.round ? (
              <>
                <span className="mx-1.5 text-slate-300">•</span>
                <span>Fecha {data.round}</span>
              </>
            ) : null}
            <span className="mx-1.5 text-slate-300">•</span>
            <span className="text-slate-700 font-semibold">{formatEditorialDate(data.match_date)}</span>
          </div>

          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isExporting}
            className="export-ignore inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200/80 transition cursor-pointer disabled:opacity-50"
            title="Exportar Lámina 01 en PNG"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>PNG</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. CABECERA DE PARTIDO (SCOREBOARD + 4 COMPARATIVE METRIC BLOCKS)   */}
      {/* =================================================================== */}
      <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-4">
        {/* Main Scoreline Row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Home Team */}
          <div className="flex items-center justify-between md:justify-end gap-3.5 text-right">
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400 font-semibold">
                LOCAL
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {home_team.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: homeColor }}
                />
                <span className="font-mono text-[11px] font-semibold text-slate-600">
                  {formatNullableDecimal(mHome.xg, 2)} xG
                </span>
              </div>
            </div>
            <img
              src={getTeamCrestUrl(home_team.team_id, home_team.logo_url)}
              alt={home_team.name}
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/liga1-logo.png';
              }}
            />
          </div>

          {/* Center Scoreboard Box */}
          <div className="flex flex-col items-center justify-center px-6 py-2 bg-white border border-slate-200/90 rounded-lg shadow-2xs min-w-[150px] mx-auto">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.2em] text-slate-400 font-semibold mb-0.5">
              FINAL
            </span>
            <div className="flex items-center gap-3 font-mono text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">
              <span>{formatNullableInt(home_team.score)}</span>
              <span className="text-slate-300 font-normal">–</span>
              <span>{formatNullableInt(away_team.score)}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 mt-1">
              {data.tournament} {data.round ? `• F${data.round}` : ''}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between md:justify-start gap-3.5 text-left">
            <img
              src={getTeamCrestUrl(away_team.team_id, away_team.logo_url)}
              alt={away_team.name}
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/liga1-logo.png';
              }}
            />
            <div className="flex flex-col items-end md:items-start">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400 font-semibold">
                VISITANTE
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {away_team.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: awayColor }}
                />
                <span className="font-mono text-[11px] font-semibold text-slate-600">
                  {formatNullableDecimal(mAway.xg, 2)} xG
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Comparative Metric Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200/70">
          {headerKpis.map((kpi) => {
            const safeHome = kpi.homeVal ?? 0;
            const safeAway = kpi.awayVal ?? 0;
            const total = safeHome + safeAway;
            const homeShare = total > 0 ? (safeHome / total) * 100 : 50;
            const awayShare = total > 0 ? (safeAway / total) * 100 : 50;
            const homeLeads = safeHome > safeAway;
            const awayLeads = safeAway > safeHome;

            return (
              <div
                key={kpi.id}
                className="bg-white border border-slate-200/80 rounded-lg px-3.5 py-2.5 flex flex-col justify-between gap-1.5"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 truncate">
                    {kpi.label}
                  </span>
                  <span className="text-[9.5px] text-slate-400 truncate">{kpi.sublabel}</span>
                </div>

                <div className="flex items-baseline justify-between font-mono tabular-nums pt-0.5">
                  <span
                    className={`text-sm sm:text-base ${
                      homeLeads ? 'font-bold text-slate-900' : 'font-medium text-slate-600'
                    }`}
                  >
                    {kpi.format(kpi.homeVal)}
                  </span>
                  <span className="text-[10px] text-slate-300">vs</span>
                  <span
                    className={`text-sm sm:text-base ${
                      awayLeads ? 'font-bold text-slate-900' : 'font-medium text-slate-600'
                    }`}
                  >
                    {kpi.format(kpi.awayVal)}
                  </span>
                </div>

                {/* Proportional Team Color Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${homeShare}%`,
                      backgroundColor: homeColor,
                      opacity: homeLeads || safeHome === safeAway ? 0.95 : 0.55,
                    }}
                  />
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${awayShare}%`,
                      backgroundColor: awayColor,
                      opacity: awayLeads || safeHome === safeAway ? 0.95 : 0.55,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. FILA CENTRAL: xG FLOW STEP CHART (LEFT) & CHANCE BALANCE (RIGHT) */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: xG Flow / Step Chart (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-900">
                xG Flow — Evolución Acumulada (0&apos; – {maxMinute}&apos;)
              </h4>
              <p className="text-[11px] text-slate-500">
                Progresión escalonada minuto a minuto e incidentes de gol
              </p>
            </div>

            {/* Compact Legend */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-700">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-1 rounded-xs"
                  style={{ backgroundColor: homeColor }}
                />
                <span>{home_team.short_name}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-1 rounded-xs"
                  style={{ backgroundColor: awayColor }}
                />
                <span>{away_team.short_name}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-900 bg-amber-400 inline-block" />
                <span>Gol</span>
              </span>
            </div>
          </div>

          <div className="relative w-full my-auto pt-2">
            <svg
              viewBox={`0 0 ${FLOW_W} ${FLOW_H}`}
              className="w-full h-auto overflow-visible select-none"
            >
              {/* Horizontal Y Gridlines */}
              {yTicks.map((yv) => {
                const py = xgToY(yv);
                return (
                  <g key={`y-tick-${yv}`}>
                    <line
                      x1={FLOW_PAD_L}
                      y1={py}
                      x2={FLOW_W - FLOW_PAD_R}
                      y2={py}
                      stroke={yv === 0 ? '#94a3b8' : '#e2e8f0'}
                      strokeWidth={yv === 0 ? 1.2 : 1}
                      strokeDasharray={yv === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={FLOW_PAD_L - 8}
                      y={py + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[10px]"
                    >
                      {yv.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Vertical X Minute Gridlines (45' Halftime emphasized) */}
              {xMinuteTicks.map((mv) => {
                const px = minToX(mv);
                const isHT = mv === 45;
                return (
                  <g key={`x-tick-${mv}`}>
                    <line
                      x1={px}
                      y1={FLOW_PAD_T}
                      x2={px}
                      y2={FLOW_PAD_T + FLOW_PLOT_H}
                      stroke={isHT ? '#94a3b8' : '#f1f5f9'}
                      strokeWidth={isHT ? 1.2 : 1}
                      strokeDasharray={isHT ? '4 3' : undefined}
                    />
                    <text
                      x={px}
                      y={FLOW_H - 10}
                      textAnchor="middle"
                      className={`font-mono text-[10px] ${
                        isHT ? 'fill-slate-700 font-bold' : 'fill-slate-400'
                      }`}
                    >
                      {isHT ? "45' HT" : `${mv}'`}
                    </text>
                  </g>
                );
              })}

              {/* Subtle Area Fills */}
              {homeStep.areaPath && (
                <path d={homeStep.areaPath} fill={homeColor} fillOpacity={0.07} />
              )}
              {awayStep.areaPath && (
                <path d={awayStep.areaPath} fill={awayColor} fillOpacity={0.07} />
              )}

              {/* Step Curves */}
              {homeStep.linePath && (
                <path
                  d={homeStep.linePath}
                  fill="none"
                  stroke={homeColor}
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                />
              )}
              {awayStep.linePath && (
                <path
                  d={awayStep.linePath}
                  fill="none"
                  stroke={awayColor}
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                />
              )}

              {/* End-of-line Cumulative xG Value Badges */}
              {(() => {
                const endX = minToX(maxMinute);
                const rawHomeY = xgToY(mHome.xg ?? 0);
                const rawAwayY = xgToY(mAway.xg ?? 0);
                let homeLabelY = rawHomeY;
                let awayLabelY = rawAwayY;
                if (Math.abs(homeLabelY - awayLabelY) < 14) {
                  if (homeLabelY <= awayLabelY) {
                    homeLabelY -= 7;
                    awayLabelY += 7;
                  } else {
                    homeLabelY += 7;
                    awayLabelY -= 7;
                  }
                }
                return (
                  <>
                    <text
                      x={endX + 6}
                      y={homeLabelY + 3.5}
                      className="font-mono text-[10.5px] font-bold"
                      fill={homeColor}
                    >
                      {formatNullableDecimal(mHome.xg, 2)}
                    </text>
                    <text
                      x={endX + 6}
                      y={awayLabelY + 3.5}
                      className="font-mono text-[10.5px] font-bold"
                      fill={awayColor}
                    >
                      {formatNullableDecimal(mAway.xg, 2)}
                    </text>
                  </>
                );
              })()}

              {/* Goal Markers & Labels */}
              {goalEvents.map((g, idx) => {
                const gx = minToX(g.minute);
                const gy = xgToY(g.is_home ? g.home_xg : g.away_xg);
                const color = g.is_home ? homeColor : awayColor;
                const labelY = gy > FLOW_PAD_T + 26 ? gy - 11 : gy + 18;
                return (
                  <g
                    key={`goal-pt-${g.minute}-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredGoal(g)}
                    onMouseLeave={() => setHoveredGoal(null)}
                  >
                    <circle
                      cx={gx}
                      cy={gy}
                      r={6.5}
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth={2}
                    />
                    <circle
                      cx={gx}
                      cy={gy}
                      r={3.8}
                      fill={color}
                    />
                    <text
                      x={Math.max(FLOW_PAD_L + 24, Math.min(FLOW_W - FLOW_PAD_R - 24, gx))}
                      y={labelY}
                      textAnchor="middle"
                      className="font-mono text-[9.5px] font-bold fill-slate-800"
                    >
                      {g.minute}&apos; {formatShortPlayerName(g.player_name)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Goal Incident Hover Pill */}
            {hoveredGoal && (
              <div className="mt-1 px-3 py-1.5 bg-slate-900 text-white rounded-md text-[11px] font-mono flex items-center justify-between">
                <span>
                  GOL {hoveredGoal.minute}&apos; — {hoveredGoal.player_name} (
                  {hoveredGoal.is_home ? home_team.short_name : away_team.short_name})
                </span>
                <span>
                  xG disp: {formatNullableDecimal(hoveredGoal.shot_xg, 2)} • Acum:{' '}
                  {formatNullableDecimal(hoveredGoal.home_xg, 2)} –{' '}
                  {formatNullableDecimal(hoveredGoal.away_xg, 2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chance Balance (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="pb-2.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-900">
                Chance Balance — Calidad de Ocasión
              </h4>
              <p className="text-[11px] text-slate-500">
                Comparativa bidireccional de volumen y peligro por zona
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-slate-500">
              <span style={{ color: homeColor }}>
                {getTeamTricode(home_team.team_id, home_team.name)}
              </span>
              <span>|</span>
              <span style={{ color: awayColor }}>
                {getTeamTricode(away_team.team_id, away_team.name)}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-around py-2 space-y-3">
            {chanceBalanceRows.map((row) => {
              const safeHome = row.homeVal ?? 0;
              const safeAway = row.awayVal ?? 0;
              const maxVal = Math.max(safeHome, safeAway, 0.01);
              const homeWidthPct = Math.min(100, (safeHome / maxVal) * 100);
              const awayWidthPct = Math.min(100, (safeAway / maxVal) * 100);
              const homeLeads = safeHome > safeAway;
              const awayLeads = safeAway > safeHome;

              return (
                <div key={row.key} className="space-y-1">
                  {/* Label & Values */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-mono tabular-nums w-12 text-left ${
                        homeLeads ? 'font-bold text-slate-900' : 'font-medium text-slate-500'
                      }`}
                    >
                      {row.format(row.homeVal)}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 text-center">
                      {row.label}
                    </span>
                    <span
                      className={`font-mono tabular-nums w-12 text-right ${
                        awayLeads ? 'font-bold text-slate-900' : 'font-medium text-slate-500'
                      }`}
                    >
                      {row.format(row.awayVal)}
                    </span>
                  </div>

                  {/* Bidirectional Diverging Butterfly Bar */}
                  <div className="grid grid-cols-2 gap-1 items-center h-2.5 bg-slate-100/90 rounded-xs p-0.5">
                    {/* Left Half (Home grows right-to-left from center) */}
                    <div className="w-full h-full flex justify-end overflow-hidden rounded-l-xs">
                      <div
                        className="h-full transition-all rounded-l-xs"
                        style={{
                          width: `${homeWidthPct}%`,
                          backgroundColor: homeColor,
                          opacity: homeLeads || safeHome === safeAway ? 0.92 : 0.45,
                        }}
                      />
                    </div>
                    {/* Right Half (Away grows left-to-right from center) */}
                    <div className="w-full h-full flex justify-start overflow-hidden rounded-r-xs">
                      <div
                        className="h-full transition-all rounded-r-xs"
                        style={{
                          width: `${awayWidthPct}%`,
                          backgroundColor: awayColor,
                          opacity: awayLeads || safeHome === safeAway ? 0.92 : 0.45,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>
              {data.has_flashscore_big_chances
                ? 'Big Chances: Proveedor oficial'
                : 'Big Chances: Tiros con xG ≥ 0.30'}
            </span>
            <span>Escala bidireccional relativa</span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. FILA INFERIOR: MAPAS DE TIROS EN ESPEJO (DOS MEDIAS CANCHAS)     */}
      {/* =================================================================== */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
        {/* Header & Visual Code Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-900">
              Mapas de Tiros en Espejo — Localización y Calidad (xG)
            </h4>
            <p className="text-[11px] text-slate-500">
              Medias canchas enfrentadas: {home_team.name} (izquierda, ataca ←) vs {away_team.name} (derecha, ataca →)
            </p>
          </div>

          {/* Shot Outcome & Size Legend */}
          <div className="flex flex-wrap items-center gap-3.5 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-3.5 h-3.5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[8px] leading-none">
                ★
              </span>
              <span>Gol</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-600/60 border border-slate-800 inline-block" />
              <span>Atajado</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-white border border-slate-700 inline-block" />
              <span>Desviado</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-300 border border-dashed border-slate-600 inline-block" />
              <span>Bloqueado</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-[10px] text-slate-500">Área burbuja ∝ xG</span>
          </div>
        </div>

        {/* Team Strip Above Facing Pitches */}
        <div className="grid grid-cols-2 gap-4 px-1">
          <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200/70 rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: homeColor }}
              />
              <span className="text-xs font-bold text-slate-900 truncate">
                {home_team.name}
              </span>
              <span className="text-[10px] font-mono text-slate-400">← ATACA</span>
            </div>
            <div className="font-mono text-[11px] text-slate-600 tabular-nums">
              <span className="font-bold text-slate-900">{formatNullableInt(mHome.shots_total)}</span> tiros •{' '}
              <span className="font-bold text-slate-900">{formatNullableInt(mHome.goals)}</span>G •{' '}
              <span className="font-bold" style={{ color: homeColor }}>
                {formatNullableDecimal(mHome.xg, 2)} xG
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200/70 rounded-lg px-3 py-1.5">
            <div className="font-mono text-[11px] text-slate-600 tabular-nums">
              <span className="font-bold" style={{ color: awayColor }}>
                {formatNullableDecimal(mAway.xg, 2)} xG
              </span>{' '}
              • <span className="font-bold text-slate-900">{formatNullableInt(mAway.goals)}</span>G •{' '}
              <span className="font-bold text-slate-900">{formatNullableInt(mAway.shots_total)}</span> tiros
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">ATACA →</span>
              <span className="text-xs font-bold text-slate-900 truncate">
                {away_team.name}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: awayColor }}
              />
            </div>
          </div>
        </div>

        {/* Facing Half-Pitches SVG Canvas */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="w-full h-auto select-none"
          >
            {/* LEFT HALF-PITCH: HOME TEAM (Attacking Left Goal at x=28) */}
            <rect
              x={LEFT_GOAL_X}
              y={PITCH_TOP}
              width={HALF_W}
              height={PITCH_H}
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth={1.5}
              rx={3}
            />
            <path
              d={`M ${LEFT_MID_X} ${CENTER_Y - 52} A 52 52 0 0 0 ${LEFT_MID_X} ${CENTER_Y + 52}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.4}
            />
            <circle cx={LEFT_MID_X} cy={CENTER_Y} r={2.5} fill="#cbd5e1" />

            <rect
              x={LEFT_GOAL_X}
              y={BOX_Y}
              width={BOX_W}
              height={BOX_H}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
            <rect
              x={LEFT_GOAL_X}
              y={SIX_Y}
              width={SIX_W}
              height={SIX_H}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
            <circle cx={LEFT_GOAL_X + PEN_SPOT_DX} cy={CENTER_Y} r={2.2} fill="#94a3b8" />
            <path
              d={`M ${LEFT_GOAL_X + BOX_W} ${CENTER_Y - 40} A 52 52 0 0 1 ${LEFT_GOAL_X + BOX_W} ${CENTER_Y + 40}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.4}
            />
            <rect
              x={LEFT_GOAL_X - 10}
              y={GOAL_Y}
              width={10}
              height={GOAL_H}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.6}
            />

            {/* RIGHT HALF-PITCH: AWAY TEAM (Attacking Right Goal at x=952) */}
            <rect
              x={RIGHT_MID_X}
              y={PITCH_TOP}
              width={HALF_W}
              height={PITCH_H}
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth={1.5}
              rx={3}
            />
            <path
              d={`M ${RIGHT_MID_X} ${CENTER_Y - 52} A 52 52 0 0 1 ${RIGHT_MID_X} ${CENTER_Y + 52}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.4}
            />
            <circle cx={RIGHT_MID_X} cy={CENTER_Y} r={2.5} fill="#cbd5e1" />

            <rect
              x={RIGHT_GOAL_X - BOX_W}
              y={BOX_Y}
              width={BOX_W}
              height={BOX_H}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
            <rect
              x={RIGHT_GOAL_X - SIX_W}
              y={SIX_Y}
              width={SIX_W}
              height={SIX_H}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
            <circle cx={RIGHT_GOAL_X - PEN_SPOT_DX} cy={CENTER_Y} r={2.2} fill="#94a3b8" />
            <path
              d={`M ${RIGHT_GOAL_X - BOX_W} ${CENTER_Y - 40} A 52 52 0 0 0 ${RIGHT_GOAL_X - BOX_W} ${CENTER_Y + 40}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.4}
            />
            <rect
              x={RIGHT_GOAL_X}
              y={GOAL_Y}
              width={10}
              height={GOAL_H}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.6}
            />

            {/* Center Divider Line */}
            <line
              x1={(LEFT_MID_X + RIGHT_MID_X) / 2}
              y1={PITCH_TOP}
              x2={(LEFT_MID_X + RIGHT_MID_X) / 2}
              y2={PITCH_TOP + PITCH_H}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray="4 4"
            />

            {/* Render Home Shots on Left Half-Pitch */}
            {mappedHomeShots.map((item) => renderShotMarker(item, homeColor))}

            {/* Render Away Shots on Right Half-Pitch */}
            {mappedAwayShots.map((item) => renderShotMarker(item, awayColor))}
          </svg>
        </div>

        {/* Hovered Shot Detail Bar */}
        <div className="min-h-[28px] px-3 py-1 bg-slate-50 border border-slate-200/70 rounded-lg flex items-center justify-between text-[11px] font-mono text-slate-600">
          {hoveredShot ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: hoveredShot.is_home ? homeColor : awayColor,
                  }}
                />
                <span className="font-bold text-slate-900">
                  {hoveredShot.minute ? `${hoveredShot.minute}' ` : ''}
                  {hoveredShot.player_name}
                  {hoveredShot.player_jersey ? ` (#${hoveredShot.player_jersey})` : ''}
                </span>
                <span className="text-slate-400">•</span>
                <span className="uppercase font-semibold text-slate-800">
                  {RESULT_LABELS[hoveredShot.result] || hoveredShot.result}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-900">
                  {formatNullableDecimal(hoveredShot.xg, 3)} xG
                </span>
                <span className="text-slate-400">•</span>
                <span>{formatNullableDecimal(hoveredShot.distance_m, 1)} m</span>
                <span className="text-slate-400">•</span>
                <span>{SITUATION_LABELS[hoveredShot.situation] || hoveredShot.situation}</span>
                <span className="text-slate-400">•</span>
                <span>{BODY_PART_LABELS[hoveredShot.body_part] || hoveredShot.body_part}</span>
              </div>
            </>
          ) : (
            <span className="text-slate-400">
              Pasa el cursor sobre cualquier disparo en los mapas para inspeccionar jugador, minuto, distancia, situación y valor de xG.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchReportSheet01;
