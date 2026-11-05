import React from 'react';
import { PlayerMatchPerformance } from '../../services/api';

interface MatchReportSheet03PlayerTableProps {
  teamName: string;
  isHome: boolean;
  teamColor: string;
  crestUrl?: string | null;
  players: PlayerMatchPerformance[];
  isEs: boolean;
}

export const MatchReportSheet03PlayerTable: React.FC<MatchReportSheet03PlayerTableProps> = ({
  teamName,
  isHome,
  teamColor,
  crestUrl,
  players,
  isEs,
}) => {
  const starters = players.filter((p) => !p.was_substitute);
  const subs = players.filter((p) => p.was_substitute && p.minutes_played > 0);

  const renderPlayerRow = (p: PlayerMatchPerformance, isSub: boolean = false) => {
    const passPct =
      p.accurate_passes_pct != null
        ? Math.round(p.accurate_passes_pct)
        : p.passes_total > 0
        ? Math.round((p.passes_completed * 100) / p.passes_total)
        : 0;

    return (
      <tr key={p.player_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
        <td className="py-1 px-1 font-mono text-[10px] text-slate-400 text-center w-6 shrink-0">
          {p.jersey_number ?? '-'}
        </td>
        <td className="py-1 px-1.5 text-left">
          <div className="font-semibold text-slate-800 text-xs truncate max-w-[110px]" title={p.name}>
            {p.name}
          </div>
          {isSub && (
            <div className="text-[9px] font-mono text-slate-400 leading-tight">
              {p.replaced_player_name
                ? `↳ ${p.subbed_in_minute}' por ${p.replaced_player_name}`
                : `↳ Entró ${p.subbed_in_minute}'`}
            </div>
          )}
        </td>
        <td className="py-1 px-1 font-mono text-[10px] text-slate-500 uppercase text-center w-8">
          {p.position}
        </td>
        <td className="py-1 px-1 font-mono text-[10px] text-slate-600 text-center w-8">
          {p.minutes_played}&apos;
        </td>
        <td className="py-1 px-1 font-mono text-xs font-bold text-slate-800 text-center w-9">
          {p.sofascore_rating != null ? p.sofascore_rating.toFixed(1) : '-'}
        </td>
        <td className="py-1 px-1 font-mono text-xs font-bold text-center w-6">
          <span className={p.goals > 0 ? 'text-emerald-600' : 'text-slate-300'}>{p.goals}</span>
        </td>
        <td className="py-1 px-1 font-mono text-xs font-bold text-center w-6">
          <span className={p.assists > 0 ? 'text-sky-600' : 'text-slate-300'}>{p.assists}</span>
        </td>
        <td className="py-1 px-1 font-mono text-[11px] text-slate-700 text-right w-10">
          {p.calculated_xg > 0 ? p.calculated_xg.toFixed(2) : '0.00'}
        </td>
        <td className="py-1 px-1 font-mono text-[10px] text-slate-600 text-center w-14">
          {p.passes_completed} ({passPct}%)
        </td>
        <td className="py-1 px-1 font-mono text-[10px] text-slate-600 text-center w-12">
          {p.recoveries}/{p.tackles}
        </td>
        <td className="py-1 px-1 font-mono text-[10px] text-slate-600 text-center w-11">
          {`${p.fouls ?? 0}/${p.was_fouled ?? 0}`}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Encabezado del Equipo */}
      <div className="border-b-2 border-slate-900 pb-1.5 mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {crestUrl && <img src={crestUrl} alt={teamName} className="w-4 h-4 object-contain" />}
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: teamColor }} />
          <h3 className="text-xs font-extrabold font-mono tracking-wider text-slate-900 uppercase truncate max-w-[280px]">
            {teamName} ({isHome ? (isEs ? 'LOCAL' : 'HOME') : isEs ? 'VISITANTE' : 'AWAY'})
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 uppercase">
          {players.length} {isEs ? 'JUGADORES' : 'PLAYERS'}
        </span>
      </div>

      {/* Subsección Titulares */}
      <div className="mb-4">
        <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase bg-slate-100 px-2 py-0.5 mb-1 rounded-sm">
          {isEs ? 'TITULARES' : 'STARTERS'} ({starters.length})
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[9px] font-mono font-bold text-slate-400 uppercase">
              <th className="py-1 px-1 text-center w-6">DOR</th>
              <th className="py-1 px-1.5 text-left">{isEs ? 'JUGADOR' : 'PLAYER'}</th>
              <th className="py-1 px-1 text-center w-8">POS</th>
              <th className="py-1 px-1 text-center w-8">MIN</th>
              <th className="py-1 px-1 text-center w-9">RAT</th>
              <th className="py-1 px-1 text-center w-6">G</th>
              <th className="py-1 px-1 text-center w-6">A</th>
              <th className="py-1 px-1 text-right w-10">xG</th>
              <th className="py-1 px-1 text-center w-14">{isEs ? 'PASES' : 'PASS'}</th>
              <th className="py-1 px-1 text-center w-12">REC/ENT</th>
              <th className="py-1 px-1 text-center w-11">{isEs ? 'FAL/REC' : 'FC/FR'}</th>
            </tr>
          </thead>
          <tbody>{starters.map((p) => renderPlayerRow(p, false))}</tbody>
        </table>
      </div>

      {/* Subsección Suplentes con Minutos */}
      <div>
        <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase bg-slate-100 px-2 py-0.5 mb-1 rounded-sm">
          {isEs ? 'SUPLENTES CON MINUTOS' : 'SUBSTITUTES USED'} ({subs.length})
        </div>
        {subs.length === 0 ? (
          <div className="text-[10px] font-mono text-slate-400 italic py-2 px-2">
            {isEs ? 'Sin sustituciones con minutos registrados' : 'No substitutes used'}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[9px] font-mono font-bold text-slate-400 uppercase">
                <th className="py-1 px-1 text-center w-6">DOR</th>
                <th className="py-1 px-1.5 text-left">{isEs ? 'JUGADOR' : 'PLAYER'}</th>
                <th className="py-1 px-1 text-center w-8">POS</th>
                <th className="py-1 px-1 text-center w-8">MIN</th>
                <th className="py-1 px-1 text-center w-9">RAT</th>
                <th className="py-1 px-1 text-center w-6">G</th>
                <th className="py-1 px-1 text-center w-6">A</th>
                <th className="py-1 px-1 text-right w-10">xG</th>
                <th className="py-1 px-1 text-center w-14">{isEs ? 'PASES' : 'PASS'}</th>
                <th className="py-1 px-1 text-center w-12">REC/ENT</th>
                <th className="py-1 px-1 text-center w-11">{isEs ? 'FAL/REC' : 'FC/FR'}</th>
              </tr>
            </thead>
            <tbody>{subs.map((p) => renderPlayerRow(p, true))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MatchReportSheet03PlayerTable;
