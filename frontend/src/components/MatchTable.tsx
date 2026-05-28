import React, { useMemo } from 'react';
import { PlayerMatchStats } from '../services/api';

interface MatchTableProps {
  matches: PlayerMatchStats[];
}

const MatchTable: React.FC<MatchTableProps> = ({ matches }) => {
  const groupedMatches = useMemo(() => {
    const groups: Record<number, PlayerMatchStats[]> = {};
    matches.forEach(m => {
      const r = m.round || 0;
      if (!groups[r]) groups[r] = [];
      groups[r].push(m);
    });

    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a)
      .map(r => ({ round: r, matches: groups[r] }));
  }, [matches]);

  return (
    <div className="overflow-x-auto border border-border rounded-lg shadow-sm">
      <table className="min-w-full text-sm text-left bg-white">
        <thead className="text-[10px] uppercase bg-white text-gray-500 font-bold border-b border-border">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">Date</th>
            <th scope="col" className="px-3 py-2 text-left">Opponent</th>
            <th scope="col" className="px-3 py-2 text-center">Result</th>
            <th scope="col" className="px-3 py-2 text-center">Min</th>
            <th scope="col" className="px-3 py-2 text-center">Rating</th>
            <th scope="col" className="px-3 py-2 text-center">G</th>
            <th scope="col" className="px-3 py-2 text-center">A</th>
            <th scope="col" className="px-3 py-2 text-center">SOT</th>
            <th scope="col" className="px-3 py-2 text-center">KP</th>
            <th scope="col" className="px-3 py-2 text-center">Pass %</th>
          </tr>
        </thead>
        <tbody>
          {groupedMatches.map(group => {
            const totalMatches = group.matches.length;
            const ratedMatches = group.matches.filter(m => m.sofascore_rating != null);
            const avgRating = ratedMatches.length > 0 
              ? ratedMatches.reduce((sum, m) => sum + (m.sofascore_rating as number), 0) / ratedMatches.length 
              : null;

            return (
              <React.Fragment key={group.round}>
                {/* Round Header / Separator */}
                <tr className="bg-[#F3F4F6] border-y border-border">
                  <td colSpan={10} className="px-3 py-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-navy text-[11px] tracking-wide">
                        {group.round === 0 ? 'OTHER MATCHES' : `APERTURA · ROUND ${group.round}`}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium uppercase">
                        {totalMatches} {totalMatches === 1 ? 'Match' : 'Matches'} · Avg Rating: {avgRating ? avgRating.toFixed(2) : '-'}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Match Rows */}
                {group.matches.map((match, idx) => (
                  <tr key={`${group.round}-${idx}`} className="border-b border-border hover:bg-[#F8F8F6] transition-colors bg-white group">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                      {new Date(match.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 font-medium text-navy text-xs">
                      <div className="flex items-center gap-2">
                        {match.opponent_logo_url ? (
                          <img
                            src={match.opponent_logo_url}
                            alt={match.opponent_name}
                            className="w-4 h-4 object-contain flex-shrink-0"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400">{match.is_home ? '(H)' : '(A)'}</span>
                        )}
                        <span>{match.opponent_name}</span>
                        <span className="text-[10px] font-normal text-gray-400 ml-1">{match.is_home ? '(H)' : '(A)'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {match.result ? (
                        <span className={`inline-flex items-center justify-center min-w-[40px] px-1.5 py-0.5 rounded font-bold text-white text-[10px] ${
                          match.result === 'W' ? 'bg-green-600' :
                          match.result === 'D' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}>
                          {match.result} {match.score && <span className="font-normal opacity-90 ml-1">{match.score}</span>}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">{match.minutes_played ?? '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {match.sofascore_rating != null ? (
                        <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded font-bold text-white text-[11px] ${
                          match.sofascore_rating >= 7.0 ? 'bg-green-500' :
                          match.sofascore_rating >= 6.0 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}>
                          {match.sofascore_rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded font-bold text-white text-[11px] bg-gray-300">
                          -
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-center text-xs ${match.goals ? 'font-bold text-navy-blue' : 'text-gray-400'}`}>
                      {match.goals ?? '-'}
                    </td>
                    <td className={`px-3 py-2 text-center text-xs ${match.assists ? 'font-bold text-navy-blue' : 'text-gray-400'}`}>
                      {match.assists ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">{match.shots_on_target ?? '-'}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">{match.key_passes ?? '-'}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">
                      {match.accurate_passes_pct != null ? `${match.accurate_passes_pct.toFixed(0)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MatchTable;
