import React from 'react';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { TeamMetricEntry, VenueFilter, ContextFilter } from '../../services/api';
import { useTeamMostUsedXI } from '../../hooks/useTeam';

export interface TeamMostUsedXICardProps {
  activeTeam: TeamMetricEntry;
  tournament?: 'all' | 'Apertura' | 'Clausura';
  venue?: VenueFilter;
  contextFilter?: ContextFilter;
}

/**
 * Formats full name into clean Opta short display name: "Initial. Surname"
 */
function formatOptaName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const initial = parts[0].charAt(0).toUpperCase();

  if (
    parts.length >= 3 &&
    ['di', 'de', 'del', 'da', 'la', 'dos', 'van', 'von'].includes(parts[parts.length - 2].toLowerCase())
  ) {
    return `${initial}. ${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  }

  const surname = parts[parts.length - 1];
  return `${initial}. ${surname}`;
}

export const TeamMostUsedXICard: React.FC<TeamMostUsedXICardProps> = ({
  activeTeam,
  tournament = 'all',
  venue = 'all',
  contextFilter = 'all',
}) => {
  const { data, isLoading, isError, error, refetch } = useTeamMostUsedXI(
    activeTeam?.team_id,
    tournament,
    venue,
    Boolean(activeTeam?.team_id),
    contextFilter
  );

  const formation = data?.formation || '4-2-3-1';
  const players = data?.players || [];

  // SVG horizontal pitch dimensions
  // Standard Opta pitch coordinate orientation: 0 (Left/GK) to 100 (Right/Attack)
  // Pitch SVG viewBox="0 0 620 400"
  const SVG_WIDTH = 620;
  const SVG_HEIGHT = 400;
  const PITCH_X = 20;
  const PITCH_Y = 20;
  const PITCH_W = 580;
  const PITCH_H = 360;

  // Convert normalized pitch coords (x: 0-100, y: 0-100) to SVG canvas pixels
  const getCanvasCoords = (normX: number, normY: number) => {
    // normX: 0 (own goal) -> 100 (opponent goal)
    // normY: 0 (right sideline) -> 100 (left sideline)
    // In SVG: top is y=0, bottom is y=PITCH_H
    // To match traditional perspective (left sideline at top or bottom):
    // normY = 0 -> bottom (y = PITCH_Y + PITCH_H - margin)
    // normY = 100 -> top (y = PITCH_Y + margin)
    const px = PITCH_X + (normX / 100) * PITCH_W;
    const py = PITCH_Y + ((100 - normY) / 100) * PITCH_H;
    return { px, py };
  };

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 gap-2">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 mt-0.5 sm:mt-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                XI Más Utilizado
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white shadow-xs">
                {formation}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              {formation} (Esquema Base) · Jugador con más minutos en cada posición · % = Cuota de minutos disponibles
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-md">
            {data?.total_matches ?? 0} {data?.total_matches === 1 ? 'Partido' : 'Partidos'} · {data?.max_minutes ?? 0} Min Max
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <span className="text-xs text-slate-500 font-medium">Calculando alineación base y cuota de minutos...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
          <p className="text-xs text-rose-700 max-w-sm mb-3">
            {error instanceof Error ? error.message : 'Error al cargar el XI más utilizado.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : players.length === 0 ? (
        <div className="py-20 text-center text-xs text-slate-500 font-medium">
          No hay datos de alineaciones disponibles para el filtro seleccionado.
        </div>
      ) : (
        /* Two-Column Layout matching Opta / TheAnalyst exact layout */
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Left Column: Horizontal Tactical Pitch graphic (~45%) */}
          <div className="w-full lg:w-[45%] flex flex-col items-center shrink-0">
            <div className="w-full relative aspect-[1.55/1] bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800">
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="w-full h-full select-none"
              >
                <defs>
                  {/* Subtle dark field grass pattern */}
                  <linearGradient id="pitchGrass" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#090d16" />
                  </linearGradient>

                  {/* Marker glow filter */}
                  <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
                  </filter>
                </defs>

                {/* Pitch background */}
                <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#pitchGrass)" />

                {/* Outer pitch boundary line */}
                <rect
                  x={PITCH_X}
                  y={PITCH_Y}
                  width={PITCH_W}
                  height={PITCH_H}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                  rx="4"
                />

                {/* Halfway line */}
                <line
                  x1={PITCH_X + PITCH_W / 2}
                  y1={PITCH_Y}
                  x2={PITCH_X + PITCH_W / 2}
                  y2={PITCH_Y + PITCH_H}
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Center circle & spot */}
                <circle
                  cx={PITCH_X + PITCH_W / 2}
                  cy={PITCH_Y + PITCH_H / 2}
                  r="52"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <circle
                  cx={PITCH_X + PITCH_W / 2}
                  cy={PITCH_Y + PITCH_H / 2}
                  r="2.5"
                  fill="#475569"
                />

                {/* Left Penalty Area (Defending / GK side) */}
                <rect
                  x={PITCH_X}
                  y={PITCH_Y + PITCH_H * 0.22}
                  width={PITCH_W * 0.165}
                  height={PITCH_H * 0.56}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                {/* Left 6-yard box */}
                <rect
                  x={PITCH_X}
                  y={PITCH_Y + PITCH_H * 0.36}
                  width={PITCH_W * 0.058}
                  height={PITCH_H * 0.28}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                {/* Left penalty spot & arc */}
                <circle
                  cx={PITCH_X + PITCH_W * 0.11}
                  cy={PITCH_Y + PITCH_H / 2}
                  r="2"
                  fill="#475569"
                />
                <path
                  d={`M ${PITCH_X + PITCH_W * 0.165} ${PITCH_Y + PITCH_H * 0.39} A 42 42 0 0 1 ${PITCH_X + PITCH_W * 0.165} ${PITCH_Y + PITCH_H * 0.61}`}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Right Penalty Area (Attacking side) */}
                <rect
                  x={PITCH_X + PITCH_W * (1 - 0.165)}
                  y={PITCH_Y + PITCH_H * 0.22}
                  width={PITCH_W * 0.165}
                  height={PITCH_H * 0.56}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                {/* Right 6-yard box */}
                <rect
                  x={PITCH_X + PITCH_W * (1 - 0.058)}
                  y={PITCH_Y + PITCH_H * 0.36}
                  width={PITCH_W * 0.058}
                  height={PITCH_H * 0.28}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                {/* Right penalty spot & arc */}
                <circle
                  cx={PITCH_X + PITCH_W * (1 - 0.11)}
                  cy={PITCH_Y + PITCH_H / 2}
                  r="2"
                  fill="#475569"
                />
                <path
                  d={`M ${PITCH_X + PITCH_W * (1 - 0.165)} ${PITCH_Y + PITCH_H * 0.39} A 42 42 0 0 0 ${PITCH_X + PITCH_W * (1 - 0.165)} ${PITCH_Y + PITCH_H * 0.61}`}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Attack Direction Indicator banner at Top-Right */}
                <g transform={`translate(${PITCH_X + PITCH_W - 90}, ${PITCH_Y + 16})`}>
                  <text
                    x="0"
                    y="0"
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="1.5"
                    className="select-none"
                  >
                    ATAQUE →
                  </text>
                </g>

                {/* 11 Player Nodes */}
                {players.map((p) => {
                  const { px, py } = getCanvasCoords(p.pitch_x, p.pitch_y);
                  const shortName = formatOptaName(p.name);
                  const isHighShare = p.minutes_share >= 75;

                  return (
                    <g key={p.slot} transform={`translate(${px}, ${py})`} className="cursor-pointer group">
                      {/* Node circle badge */}
                      <circle
                        r="15"
                        fill={isHighShare ? '#2563eb' : '#1e293b'}
                        stroke={isHighShare ? '#60a5fa' : '#475569'}
                        strokeWidth="2"
                        filter="url(#nodeGlow)"
                        className="transition-transform duration-200 group-hover:scale-110"
                      />

                      {/* Minutes share percentage inside the circle */}
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontWeight="800"
                        className="select-none pointer-events-none tracking-tighter"
                      >
                        {p.minutes_share}%
                      </text>

                      {/* Tactical Slot badge pill above the circle */}
                      <g transform="translate(0, -20)">
                        <rect
                          x="-13"
                          y="-6"
                          width="26"
                          height="12"
                          rx="3"
                          fill="#0f172a"
                          stroke="#334155"
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="7.5"
                          fontWeight="700"
                          className="select-none pointer-events-none"
                        >
                          {p.slot}
                        </text>
                      </g>

                      {/* Player short name below circle */}
                      <text
                        x="0"
                        y="25"
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize="9.5"
                        fontWeight="600"
                        className="select-none pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      >
                        {shortName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Right Column: Tabular Breakdown matching Opta exact columns (~55%) */}
          <div className="w-full lg:w-[55%] overflow-x-auto min-w-0">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-1.5 text-center w-11">POS</th>
                  <th className="py-2.5 px-2 text-left">JUGADOR</th>
                  <th className="py-2.5 px-2 text-left w-32">CUOTA MINUTOS</th>
                  <th className="py-2.5 px-1.5 text-center w-10">EDAD</th>
                  <th className="py-2.5 px-1.5 text-center w-14">TIT/PJ</th>
                  <th className="py-2.5 px-1.5 text-center w-12">G+A</th>
                  <th className="py-2.5 px-1.5 text-center w-12">xG</th>
                  <th className="py-2.5 px-1.5 text-center w-16">TIROS/90</th>
                  <th className="py-2.5 px-1.5 text-center w-14">AMARILLAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {players.map((p) => {
                  const isGK = p.slot === 'GK' || p.slot === 'G' || p.position_group === 'Goalkeeper';
                  return (
                    <tr
                      key={p.slot}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. Tactical Slot Tag */}
                      <td className="py-2 px-1.5 text-center font-bold">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors">
                          {p.slot}
                        </span>
                      </td>

                      {/* 2. Player Display Name + Jersey */}
                      <td className="py-2 px-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-medium text-slate-400 font-mono w-5 text-right shrink-0">
                            {p.shirt_number ? `#${p.shirt_number}` : '—'}
                          </span>
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {p.name}
                          </span>
                        </div>
                      </td>

                      {/* 3. Horizontal Progress Bar + Percentage */}
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[75px] sm:w-[85px] h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 shrink-0">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-500"
                              style={{ width: `${Math.min(100, p.minutes_share)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-800 font-mono w-8 text-right shrink-0">
                            {p.minutes_share}%
                          </span>
                        </div>
                      </td>

                      {/* 4. Age */}
                      <td className="py-2 px-1.5 text-center font-medium text-slate-600">
                        {p.age ?? '—'}
                      </td>

                      {/* 5. TIT / PJ */}
                      <td className="py-2 px-1.5 text-center">
                        <span className="font-bold text-slate-900">{p.starts}</span>
                        <span className="text-slate-400 text-[11px]">/{data?.total_matches ?? p.apps}</span>
                      </td>

                      {/* 6 & 7. GK Atajadas / Outfield G+A and xG */}
                      {isGK ? (
                        <td colSpan={2} className="py-2 px-1.5 text-center">
                          {p.saves && p.saves > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200/90 px-2 py-0.5 rounded shadow-2xs whitespace-nowrap"
                              title={`${p.saves} atajadas registradas en la temporada`}
                            >
                              <span className="text-sky-600 font-semibold">Atajadas:</span> {p.saves}
                              <span className="text-[10px] text-sky-600 font-medium font-mono">
                                ({p.saves_p90 ? `${p.saves_p90.toFixed(1)}/pj` : `${(p.saves / Math.max(p.apps || 1, 1)).toFixed(1)}/pj`})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">Atajadas: —</span>
                          )}
                        </td>
                      ) : (
                        <>
                          {/* 6. G+A Breakdown */}
                          <td className="py-2 px-1.5 text-center">
                            <div className="inline-flex items-center gap-0.5 font-bold text-slate-900">
                              <span>{p.g_plus_a}</span>
                              {(p.goals > 0 || p.assists > 0) && (
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({p.goals}+{p.assists})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 7. xG */}
                          <td className="py-2 px-1.5 text-center font-mono font-bold text-slate-800">
                            {p.xg > 0 ? p.xg.toFixed(2) : '0.00'}
                          </td>
                        </>
                      )}

                      {/* 8. Tiros/90 */}
                      <td className="py-2 px-1.5 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                        {isGK ? (
                          <span className="text-slate-300 font-mono text-[11px]">—</span>
                        ) : (
                          <>
                            <span className="font-semibold text-slate-900">
                              {(p.shots_p90 ?? 0).toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans ml-0.5">/90m</span>
                          </>
                        )}
                      </td>

                      {/* 9. Amarillas con alerta "En Capilla" */}
                      <td className="py-2 px-1.5 text-center">
                        {p.yellow_cards === 4 ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono font-extrabold text-amber-950 text-[11px] bg-amber-500/20 border-2 border-amber-500 px-1.5 py-0.5 rounded shadow-xs animate-pulse cursor-help"
                            title="En Capilla: 4 amonestaciones acumuladas (a 1 de suspensión)"
                          >
                            <span className="w-2 h-2.5 bg-amber-500 border border-amber-600 rounded-[1px] inline-block shadow-2xs shrink-0" />
                            <span>4</span>
                            <span className="text-[9px] font-sans font-black text-amber-900 tracking-tighter">
                              ⚠️
                            </span>
                          </span>
                        ) : (p.yellow_cards ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-800 text-[11px] bg-amber-50 border border-amber-200/90 px-1.5 py-0.5 rounded shadow-2xs">
                            <span className="w-2 h-2.5 bg-amber-400 border border-amber-500/80 rounded-[1px] inline-block shadow-2xs shrink-0" />
                            {p.yellow_cards}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMostUsedXICard;
