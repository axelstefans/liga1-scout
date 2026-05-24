import React from 'react';
import { PlayerMatchStats } from '../services/api';

interface MatchTableProps {
  matches: PlayerMatchStats[];
}

const MatchTable: React.FC<MatchTableProps> = ({ matches }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead className="text-xs uppercase bg-cream text-navy font-bold border-b border-border">
          <tr>
            <th scope="col" className="px-4 py-3">Date</th>
            <th scope="col" className="px-4 py-3">Opponent</th>
            <th scope="col" className="px-4 py-3 text-center">Result</th>
            <th scope="col" className="px-4 py-3 text-center">Mins</th>
            <th scope="col" className="px-4 py-3 text-center">G</th>
            <th scope="col" className="px-4 py-3 text-center">A</th>
            <th scope="col" className="px-4 py-3 text-center">Shots</th>
            <th scope="col" className="px-4 py-3 text-center">Rating</th>
          </tr>
        </thead>
        <tbody>
          {matches.slice(0, 10).map((match, idx) => (
            <tr key={idx} className="border-b border-border hover:bg-cream/50 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                {new Date(match.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </td>
              <td className="px-4 py-3 font-medium text-navy">
                <div className="flex items-center gap-2">
                  {/* Opponent team logo (20px) */}
                  {match.opponent_logo_url ? (
                    <img
                      src={match.opponent_logo_url}
                      alt={match.opponent_name}
                      className="w-5 h-5 object-contain flex-shrink-0"
                    />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{match.is_home ? '(H)' : '(A)'}</span>
                  )}
                  <span>{match.opponent_name}</span>
                </div>
              </td>
              {/* Result badge: W/D/L with score */}
              <td className="px-4 py-3 text-center">
                {match.result ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-white text-xs ${
                    match.result === 'W' ? 'bg-green-600' :
                    match.result === 'D' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {match.result}
                    {match.score && <span className="font-normal opacity-90">{match.score}</span>}
                  </span>
                ) : '-'}
              </td>
              <td className="px-4 py-3 text-center">{match.minutes_played ?? '-'}</td>
              <td className="px-4 py-3 text-center font-bold text-navy-blue">{match.goals ?? '-'}</td>
              <td className="px-4 py-3 text-center text-navy-blue">{match.assists ?? '-'}</td>
              <td className="px-4 py-3 text-center">{match.shots_on_target ?? '-'}</td>
              <td className="px-4 py-3 text-center font-bold">
                {match.sofascore_rating != null ? (
                  <span className={`px-2 py-1 rounded text-white ${
                    match.sofascore_rating >= 7.0 ? 'bg-green-500' :
                    match.sofascore_rating >= 6.5 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {match.sofascore_rating.toFixed(1)}
                  </span>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {matches.length > 10 && (
         <div className="text-center mt-4">
            <button className="text-sm font-semibold text-navy-blue hover:underline">View all matches</button>
         </div>
      )}
    </div>
  );
};

export default MatchTable;
