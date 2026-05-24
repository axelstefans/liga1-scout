import React from 'react';
import { PlayerMatchStats } from '../services/api';
import clsx from 'clsx';

interface FormStripProps {
  matches: PlayerMatchStats[];
}

const FormStrip: React.FC<FormStripProps> = ({ matches }) => {
  // Take the 5 most recent matches (assuming they are ordered DESC by date)
  const recent = matches.slice(0, 5).reverse();

  return (
    <div className="flex items-center space-x-2">
      {recent.map((match, idx) => {
        const rating = match.sofascore_rating || 0;
        
        // Define color loosely based on standard rating scales
        let colorClass = "bg-gray-300 text-gray-800";
        if (rating >= 7.5) colorClass = "bg-green-600 text-white";
        else if (rating >= 7.0) colorClass = "bg-green-500 text-white";
        else if (rating >= 6.5) colorClass = "bg-yellow-500 text-white";
        else if (rating > 0) colorClass = "bg-red-500 text-white";

        return (
          <div 
            key={idx} 
            className={clsx(
              "flex flex-col items-center justify-center w-12 h-12 rounded shadow-sm border border-border",
              colorClass
            )}
            title={`vs ${match.opponent_name} - ${rating.toFixed(1)}`}
          >
            <span className="font-bold text-sm">
              {rating > 0 ? rating.toFixed(1) : '-'}
            </span>
            {/* W/D/L is hard to know without full match score, just show home/away indicator for now */}
            <span className="text-[10px] opacity-80 font-bold">
              {match.is_home ? 'H' : 'A'}
            </span>
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
