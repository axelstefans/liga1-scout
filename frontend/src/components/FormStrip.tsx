import React from 'react';
import { PlayerMatchStats } from '../services/api';
import clsx from 'clsx';

interface FormStripProps {
  matches: PlayerMatchStats[];
}

const FormStrip: React.FC<FormStripProps> = ({ matches }) => {
  // Take the 5 most recent matches (already ordered DESC by date from API)
  const recent = matches.slice(0, 5).reverse();

  return (
    <div className="flex items-center space-x-2">
      {recent.map((match, idx) => {
        const rating = match.sofascore_rating;
        const result = match.result;

        // Color based on match result (W/D/L), fallback to gray if unknown
        const bgClass =
          result === 'W' ? 'bg-green-600 text-white' :
          result === 'D' ? 'bg-yellow-500 text-white' :
          result === 'L' ? 'bg-red-500 text-white' :
          'bg-gray-300 text-gray-700';

        return (
          <div
            key={idx}
            className={clsx(
              'flex flex-col items-center justify-center w-14 h-16 rounded shadow-sm border border-border gap-0.5',
              bgClass
            )}
            title={`vs ${match.opponent_name}  ${match.score ?? ''}  Rating: ${rating ? rating.toFixed(1) : 'N/A'}`}
          >
            {/* W / D / L badge */}
            <span className="text-sm font-black leading-tight">
              {result ?? '?'}
            </span>

            {/* SofaScore rating */}
            <span className="text-xs font-semibold leading-tight opacity-90">
              {rating ? rating.toFixed(1) : '-'}
            </span>

            {/* Opponent team logo (24px), fallback to initials if no URL */}
            {match.opponent_logo_url ? (
              <img
                src={match.opponent_logo_url}
                alt={match.opponent_name}
                className="w-6 h-6 object-contain rounded-sm"
              />
            ) : (
              <span className="text-[9px] font-bold opacity-70 leading-tight uppercase tracking-wide">
                {match.opponent_name.slice(0, 3)}
              </span>
            )}
          </div>
        );
      })}
      {recent.length === 0 && (
        <span className="text-gray-500 text-sm">No recent matches.</span>
      )}
    </div>
  );
};

export default FormStrip;
