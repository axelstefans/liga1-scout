import React from 'react';
import {
  MatchVenueInfo,
  MatchRefereeInfo,
  GoalIncident,
  CardIncident,
  GameStateSummary,
  HalfPeriodStats,
  AttackChannelBreakdown,
  ShotTypologySummary,
} from '../../services/api';
import { MatchSheet03Translations } from '../../i18n/scoutingReport';
import { getTeamCrestUrl } from '../../utils/teams';

// Helper to compute ratio between two positive values
function computeRatio(h: number | null | undefined, a: number | null | undefined): { hRatio: number; aRatio: number } | null {
  const numH = h ?? 0;
  const numA = a ?? 0;
  const sum = numH + numA;
  if (sum <= 0) return null;
  const hRatio = Math.round((numH / sum) * 100);
  return { hRatio, aRatio: 100 - hRatio };
}

// ---------------------------------------------------------------------------
// 1. FRANJA DE CONTEXTO (Sede, Altitud, Superficie, Árbitro)
// ---------------------------------------------------------------------------
export interface MatchContextFriezeProps {
  venue?: MatchVenueInfo | null;
  referee?: MatchRefereeInfo | null;
  t: MatchSheet03Translations;
}

export const MatchContextFrieze: React.FC<MatchContextFriezeProps> = ({ venue, referee, t }) => {
  const stadium = venue?.stadium?.trim() || null;
  const city = venue?.city?.trim() || null;
  const altitude = venue?.altitude != null ? `${venue.altitude} ${t.venue.altitude}` : null;
  const surface = venue?.surface?.trim() || null;

  const venueParts = [stadium, city, altitude, surface].filter(Boolean);
  const venueText = venueParts.length > 0 ? venueParts.join(' · ') : t.venue.unavailable;

  const refereeName = referee?.name?.trim() || null;
  const sampleMatches = referee?.sample_matches ?? 0;
  const isSmallSample = referee?.is_small_sample ?? (sampleMatches < 5);
  const yc = referee?.yellow_cards_per_match != null ? `${referee.yellow_cards_per_match.toFixed(2)} TA/p` : null;
  const rc = referee?.red_cards_per_match != null ? `${referee.red_cards_per_match.toFixed(2)} TR/p` : null;
  const cardStats = [yc, rc].filter(Boolean).join(' · ');

  return (
    <div className="w-full py-2 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600 gap-4 flex-wrap">
      {/* Sede / Estadio */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-slate-400 font-bold uppercase tracking-wider">{t.venue.stadium}:</span>
        <span className="text-slate-800 font-medium truncate">{venueText}</span>
      </div>

      {/* Árbitro */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-slate-400 font-bold uppercase tracking-wider">{t.venue.referee}:</span>
        {refereeName ? (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-800 font-medium">{refereeName}</span>
            <span className="text-slate-400">({sampleMatches} PJ{cardStats ? ` · ${cardStats}` : ''})</span>
            {isSmallSample && (
              <span className="px-1.5 py-0.2 text-[9px] bg-amber-50 text-amber-700 border border-amber-200 rounded leading-tight font-semibold uppercase">
                [{t.venue.smallSample}]
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 font-medium">{t.venue.unavailable}</span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. CRONOLOGÍA DE GOLES Y GAME STATE
// ---------------------------------------------------------------------------
export interface GoalsAndGameStateModuleProps {
  goals?: GoalIncident[];
  cards?: CardIncident[];
  gameState?: GameStateSummary | null;
  homeTeam: { name: string; short_name?: string | null; team_id: number; logo_url?: string | null };
  awayTeam: { name: string; short_name?: string | null; team_id: number; logo_url?: string | null };
  homeColor: string;
  awayColor: string;
  areColorsSimilar: boolean;
  t: MatchSheet03Translations;
}

export const GoalsAndGameStateModule: React.FC<GoalsAndGameStateModuleProps> = ({
  goals = [],
  cards = [],
  gameState,
  homeTeam,
  awayTeam,
  homeColor,
  awayColor,
  areColorsSimilar,
  t,
}) => {
  const homeShort = homeTeam.short_name || homeTeam.name;
  const awayShort = awayTeam.short_name || awayTeam.name;

  const leadPct = gameState?.lead_pct ?? 0;
  const drawPct = gameState?.draw_pct ?? 100;
  const trailPct = gameState?.trail_pct ?? 0;

  const leadMin = gameState?.lead_minutes ?? 0;
  const drawMin = gameState?.draw_minutes ?? (gameState ? 90 : 0);
  const trailMin = gameState?.trail_minutes ?? 0;

  // Pattern style for visual distinction if colors are similar
  const awayStyle = areColorsSimilar
    ? {
        backgroundColor: awayColor,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.4) 4px, rgba(255,255,255,0.4) 8px)',
      }
    : { backgroundColor: awayColor };

  return (
    <div className="w-full bg-slate-50/70 border border-slate-200 p-3.5 mt-3 flex flex-col gap-3">
      {/* Encabezado de Game State */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
          {t.gameState.title}
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {t.gameState.regulationTime}
        </span>
      </div>

      {/* Barra proporcional de Game State */}
      <div className="flex flex-col gap-1.5">
        <div className="w-full h-3.5 bg-slate-200 flex overflow-hidden rounded-xs border border-slate-300">
          {leadPct > 0 && (
            <div
              style={{ width: `${leadPct}%`, backgroundColor: homeColor }}
              className="h-full transition-all"
              title={`${homeShort}: ${leadMin}' (${leadPct}%)`}
            />
          )}
          {drawPct > 0 && (
            <div
              style={{ width: `${drawPct}%`, backgroundColor: '#94a3b8' }}
              className="h-full transition-all"
              title={`${t.gameState.draw}: ${drawMin}' (${drawPct}%)`}
            />
          )}
          {trailPct > 0 && (
            <div
              style={{ width: `${trailPct}%`, ...awayStyle }}
              className="h-full transition-all"
              title={`${awayShort}: ${trailMin}' (${trailPct}%)`}
            />
          )}
        </div>

        {/* Leyenda y porcentajes */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 flex-wrap gap-2">
          {/* Tramo Local */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: homeColor }} />
            <span className="font-semibold text-slate-800">{homeShort}:</span>
            <span>{leadMin}&apos; ({leadPct.toFixed(1)}%)</span>
          </div>

          {/* Tramo Empate */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-400" />
            <span className="font-semibold text-slate-800">{t.gameState.draw}:</span>
            <span>{drawMin}&apos; ({drawPct.toFixed(1)}%)</span>
          </div>

          {/* Tramo Visitante */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={awayStyle} />
            <span className="font-semibold text-slate-800">{awayShort}:</span>
            <span>{trailMin}&apos; ({trailPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Cronología de goles */}
      <div className="pt-2 border-t border-slate-200/80">
        {goals.length === 0 ? (
          <div className="text-[11px] font-mono text-slate-400 italic">
            {t.gameState.noGoals}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {goals.map((g, idx) => {
              const isHomeScorer = g.team_id === homeTeam.team_id;
              const scorerColor = isHomeScorer ? homeColor : awayColor;
              const teamCrest = isHomeScorer
                ? getTeamCrestUrl(homeTeam.team_id, homeTeam.logo_url ?? undefined)
                : getTeamCrestUrl(awayTeam.team_id, awayTeam.logo_url ?? undefined);

              return (
                <div
                  key={`${g.minute}-${g.player_name}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-xs font-mono text-slate-800 shadow-2xs"
                >
                  <span className="font-bold text-slate-900">{g.minute_display || `${g.minute}'`}</span>
                  <span className="px-1 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                    {g.score}
                  </span>
                  <img src={teamCrest} alt="" className="w-3.5 h-3.5 object-contain" />
                  <span
                    className="font-bold underline decoration-2 underline-offset-2"
                    style={{ textDecorationColor: scorerColor }}
                  >
                    {g.player_name}
                  </span>
                  <span className="text-[10px] text-slate-400">({g.incident_type})</span>
                  {g.assister_name && (
                    <span className="text-[10px] text-slate-400">· as. {g.assister_name}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Incidencias de tarjetas disciplinarias */}
      {cards.length > 0 && (
        <div className="pt-2 border-t border-slate-200/80">
          <div className="flex flex-wrap items-center gap-2">
            {cards.map((c, idx) => {
              const isHomeCard = c.team_id === homeTeam.team_id;
              const teamCrest = isHomeCard
                ? getTeamCrestUrl(homeTeam.team_id, homeTeam.logo_url ?? undefined)
                : getTeamCrestUrl(awayTeam.team_id, awayTeam.logo_url ?? undefined);

              const cardTypeLower = (c.card_type || '').toLowerCase();
              const isRed = cardTypeLower === 'red' || cardTypeLower === 'directred';
              const isYellowRed = cardTypeLower === 'yellowred' || cardTypeLower === 'secondyellow';

              return (
                <div
                  key={`${c.id ?? idx}-${c.minute}-${c.player_id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-xs font-mono text-slate-800 shadow-2xs"
                >
                  <span className="font-bold text-slate-900">{c.minute_display || `${c.minute}'`}</span>
                  {isYellowRed ? (
                    <span className="flex items-center gap-0.5" title="Segunda amarilla / Roja">
                      <span className="w-2.5 h-3.5 rounded-[1px] bg-amber-400 inline-block shadow-xs" />
                      <span className="w-2.5 h-3.5 rounded-[1px] bg-rose-600 inline-block shadow-xs" />
                    </span>
                  ) : isRed ? (
                    <span className="w-2.5 h-3.5 rounded-[1px] bg-rose-600 inline-block shadow-xs" title="Tarjeta roja" />
                  ) : (
                    <span className="w-2.5 h-3.5 rounded-[1px] bg-amber-400 inline-block shadow-xs" title="Tarjeta amarilla" />
                  )}
                  <img src={teamCrest} alt="" className="w-3.5 h-3.5 object-contain" />
                  <span className="font-semibold text-slate-800">
                    {c.player_name || '-'}
                  </span>
                  {c.reason && (
                    <span className="text-[10px] text-slate-400">({c.reason})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. DESGLOSE POR MITADES (1T / 2T)
// ---------------------------------------------------------------------------
export interface HalvesBreakdownModuleProps {
  halves?: HalfPeriodStats[];
  homeShort: string;
  awayShort: string;
  homeColor: string;
  awayColor: string;
  t: MatchSheet03Translations;
}

export const HalvesBreakdownModule: React.FC<HalvesBreakdownModuleProps> = ({
  halves = [],
  homeShort,
  awayShort,
  homeColor,
  awayColor,
  t,
}) => {
  const firstHalf = halves.find((h) => h.period === '1ST') || halves[0];
  const secondHalf = halves.find((h) => h.period === '2ND') || halves[1];

  const renderHalfCard = (half: HalfPeriodStats | undefined, title: string) => {
    if (!half) return null;

    const metrics = [
      {
        label: t.halves.goals,
        hVal: half.home_goals,
        aVal: half.away_goals,
        ratio: computeRatio(half.home_goals, half.away_goals),
      },
      {
        label: t.halves.xg,
        hVal: half.home_xg != null ? half.home_xg.toFixed(2) : '—',
        aVal: half.away_xg != null ? half.away_xg.toFixed(2) : '—',
        ratio: computeRatio(half.home_xg, half.away_xg),
      },
      {
        label: t.halves.shotsTotal || t.halves.shots,
        hVal: half.home_shots != null ? half.home_shots : '—',
        aVal: half.away_shots != null ? half.away_shots : '—',
        ratio: computeRatio(half.home_shots, half.away_shots),
      },
      {
        label: t.halves.shotsOnTarget || 'Tiros a Puerta',
        hVal: half.home_shots_on_target != null ? half.home_shots_on_target : '—',
        aVal: half.away_shots_on_target != null ? half.away_shots_on_target : '—',
        ratio: computeRatio(half.home_shots_on_target, half.away_shots_on_target),
      },
      {
        label: t.halves.corners,
        hVal: half.home_corners,
        aVal: half.away_corners,
        ratio: computeRatio(half.home_corners, half.away_corners),
      },
      {
        label: t.halves.fouls,
        hVal: half.home_fouls,
        aVal: half.away_fouls,
        ratio: computeRatio(half.home_fouls, half.away_fouls),
      },
      {
        label: t.halves.yellowCards,
        hVal: half.home_yellow_cards,
        aVal: half.away_yellow_cards,
        ratio: computeRatio(half.home_yellow_cards, half.away_yellow_cards),
      },
      {
        label: t.halves.possession,
        hVal: `${half.home_possession.toFixed(1)}%`,
        aVal: `${half.away_possession.toFixed(1)}%`,
        ratio: { hRatio: Math.round(half.home_possession), aRatio: Math.round(half.away_possession) },
      },
    ];

    return (
      <div className="flex-1 flex flex-col border border-slate-200 bg-white p-3">
        <div className="font-mono text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
          <span>{title}</span>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{homeShort}</span>
            <span>vs</span>
            <span>{awayShort}</span>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-slate-100">
          {metrics.map((m) => (
            <div key={m.label} className="py-1 flex items-center justify-between text-xs font-mono">
              <span className="w-10 text-right font-bold text-slate-800">{m.hVal}</span>
              <div className="flex-1 px-2 text-center flex flex-col items-center">
                <span className="text-[11px] font-sans text-slate-500">{m.label}</span>
                {m.ratio && (
                  <div className="w-16 h-[2px] bg-slate-100 flex overflow-hidden rounded-full mt-0.5">
                    <div style={{ width: `${m.ratio.hRatio}%`, backgroundColor: homeColor }} className="h-full" />
                    <div style={{ width: `${m.ratio.aRatio}%`, backgroundColor: awayColor }} className="h-full" />
                  </div>
                )}
              </div>
              <span className="w-10 text-left font-bold text-slate-800">{m.aVal}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="border-b-2 border-slate-900 pb-1.5 flex items-center justify-between">
        <h2 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase">
          {t.halves.title}
        </h2>
      </div>
      <div className="flex gap-4">
        {renderHalfCard(firstHalf, t.halves.firstHalf)}
        {renderHalfCard(secondHalf, t.halves.secondHalf)}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. CANALES DE ATAQUE Y TIPOLOGÍA DE REMATES
// ---------------------------------------------------------------------------
export interface TacticalChannelsAndTypologyProps {
  homeChannels?: AttackChannelBreakdown | null;
  awayChannels?: AttackChannelBreakdown | null;
  homeShots?: ShotTypologySummary | null;
  awayShots?: ShotTypologySummary | null;
  homeShort: string;
  awayShort: string;
  homeColor: string;
  awayColor: string;
  t: MatchSheet03Translations;
}

export const TacticalChannelsAndTypologyModule: React.FC<TacticalChannelsAndTypologyProps> = ({
  homeChannels,
  awayChannels,
  homeShots,
  awayShots,
  homeShort,
  awayShort,
  homeColor,
  awayColor,
  t,
}) => {
  // Format attack channels respecting backend coordinates orientation
  const formatChannel = (ch: AttackChannelBreakdown | null | undefined, pos: 'left' | 'center' | 'right') => {
    if (!ch || ch.total_passes === 0) return '—';
    const comp = pos === 'left' ? ch.left_passes_completed : (pos === 'center' ? ch.center_passes_completed : ch.right_passes_completed);
    const pct = pos === 'left' ? ch.left_pct : (pos === 'center' ? ch.center_pct : ch.right_pct);
    if (pct == null) return `${comp}`;
    return `${comp} (${Math.round(pct)}%)`;
  };

  const channelRows = [
    {
      label: t.attackChannels.left,
      hVal: formatChannel(homeChannels, 'left'),
      aVal: formatChannel(awayChannels, 'left'),
      ratio: computeRatio(homeChannels?.left_passes_completed, awayChannels?.left_passes_completed),
    },
    {
      label: t.attackChannels.center,
      hVal: formatChannel(homeChannels, 'center'),
      aVal: formatChannel(awayChannels, 'center'),
      ratio: computeRatio(homeChannels?.center_passes_completed, awayChannels?.center_passes_completed),
    },
    {
      label: t.attackChannels.right,
      hVal: formatChannel(homeChannels, 'right'),
      aVal: formatChannel(awayChannels, 'right'),
      ratio: computeRatio(homeChannels?.right_passes_completed, awayChannels?.right_passes_completed),
    },
  ];

  const shotRows = [
    {
      label: t.shotTypology.openPlay,
      hVal: homeShots?.open_play ?? 0,
      aVal: awayShots?.open_play ?? 0,
      ratio: computeRatio(homeShots?.open_play, awayShots?.open_play),
    },
    {
      label: t.shotTypology.setPiece,
      hVal: homeShots?.set_piece ?? 0,
      aVal: awayShots?.set_piece ?? 0,
      ratio: computeRatio(homeShots?.set_piece, awayShots?.set_piece),
    },
    {
      label: t.shotTypology.counterAttack,
      hVal: homeShots?.counter_attack ?? 0,
      aVal: awayShots?.counter_attack ?? 0,
      ratio: computeRatio(homeShots?.counter_attack, awayShots?.counter_attack),
    },
    {
      label: t.shotTypology.penalty,
      hVal: homeShots?.penalty ?? 0,
      aVal: awayShots?.penalty ?? 0,
      ratio: computeRatio(homeShots?.penalty, awayShots?.penalty),
    },
  ];

  // Include 'other' if present in either team
  if ((homeShots?.other ?? 0) > 0 || (awayShots?.other ?? 0) > 0) {
    shotRows.push({
      label: t.shotTypology.other,
      hVal: homeShots?.other ?? 0,
      aVal: awayShots?.other ?? 0,
      ratio: computeRatio(homeShots?.other, awayShots?.other),
    });
  }

  // Total row
  shotRows.push({
    label: t.shotTypology.total,
    hVal: homeShots?.total ?? 0,
    aVal: awayShots?.total ?? 0,
    ratio: computeRatio(homeShots?.total, awayShots?.total),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="border-b-2 border-slate-900 pb-1.5 flex items-center justify-between">
        <h2 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase">
          {t.attackChannels.title} & {t.shotTypology.title}
        </h2>
      </div>

      <div className="flex gap-4">
        {/* Canales de ataque */}
        <div className="flex-1 flex flex-col border border-slate-200 bg-white p-3">
          <div className="font-mono text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
            <span>{t.attackChannels.title}</span>
            <span className="text-[10px] text-slate-400">{t.attackChannels.subtitle}</span>
          </div>
          <div className="flex flex-col divide-y divide-slate-100">
            {channelRows.map((r) => (
              <div key={r.label} className="py-1 flex items-center justify-between text-xs font-mono">
                <span className="w-14 text-right font-bold text-slate-800">{r.hVal}</span>
                <div className="flex-1 px-2 text-center flex flex-col items-center">
                  <span className="text-[11px] font-sans text-slate-500">{r.label}</span>
                  {r.ratio && (
                    <div className="w-16 h-[2px] bg-slate-100 flex overflow-hidden rounded-full mt-0.5">
                      <div style={{ width: `${r.ratio.hRatio}%`, backgroundColor: homeColor }} className="h-full" />
                      <div style={{ width: `${r.ratio.aRatio}%`, backgroundColor: awayColor }} className="h-full" />
                    </div>
                  )}
                </div>
                <span className="w-14 text-left font-bold text-slate-800">{r.aVal}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tipología de remate */}
        <div className="flex-1 flex flex-col border border-slate-200 bg-white p-3">
          <div className="font-mono text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
            <span>{t.shotTypology.title}</span>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span>{homeShort}</span>
              <span>vs</span>
              <span>{awayShort}</span>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-slate-100">
            {shotRows.map((r) => {
              const isTotal = r.label === t.shotTypology.total;
              return (
                <div
                  key={r.label}
                  className={`py-1 flex items-center justify-between text-xs font-mono ${
                    isTotal ? 'font-bold bg-slate-50/80 -mx-1 px-1 mt-0.5' : ''
                  }`}
                >
                  <span className="w-10 text-right font-bold text-slate-800">{r.hVal}</span>
                  <div className="flex-1 px-2 text-center flex flex-col items-center">
                    <span className={`text-[11px] font-sans ${isTotal ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                      {r.label}
                    </span>
                    {!isTotal && r.ratio && (
                      <div className="w-16 h-[2px] bg-slate-100 flex overflow-hidden rounded-full mt-0.5">
                        <div style={{ width: `${r.ratio.hRatio}%`, backgroundColor: homeColor }} className="h-full" />
                        <div style={{ width: `${r.ratio.aRatio}%`, backgroundColor: awayColor }} className="h-full" />
                      </div>
                    )}
                  </div>
                  <span className="w-10 text-left font-bold text-slate-800">{r.aVal}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
