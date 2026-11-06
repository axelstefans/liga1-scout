import React, { useState } from 'react';
import { SimilarPlayer } from '../../../services/api';

export interface SimilarPlayerRowProps {
  player: SimilarPlayer;
  rank: number;
  clubCrestUrl: string;
  clubName: string;
  onSelect: (id: number) => void;
}

export const SimilarPlayerRow: React.FC<SimilarPlayerRowProps> = ({
  player,
  rank,
  clubCrestUrl,
  clubName,
  onSelect,
}) => {
  const [imgError, setImgError] = useState(false);
  const pct = Number(player.similarity_pct) || 0;

  return (
    <div
      onClick={() => onSelect(player.player_id)}
      className="grid grid-cols-[16px_24px_115px_1fr_44px] items-center gap-2.5 px-2.5 hover:bg-slate-50/70 transition-colors cursor-pointer group flex-1 min-h-0"
    >
      {/* Col 1 (Rank) */}
      <span className="text-[11px] font-normal text-slate-400 text-center select-none">{rank}</span>

      {/* Col 2 (Avatar) */}
      {!imgError ? (
        <img
          src={`/players/${player.player_id}.png`}
          alt={player.name}
          onError={() => setImgError(true)}
          className="w-6 h-6 max-w-[24px] max-h-[24px] rounded-full object-cover border border-slate-200/90 shrink-0"
        />
      ) : (
        <div className="w-6 h-6 max-w-[24px] max-h-[24px] rounded-full bg-slate-100 border border-slate-200/90 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      )}

      {/* Col 3 (Player Name) */}
      <span className="text-[11px] font-semibold text-slate-800 truncate group-hover:text-blue-700">
        {player.name}
      </span>

      {/* Col 4 (Club) */}
      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
        <img
          src={clubCrestUrl}
          alt={clubName}
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== '/liga1-logo.png') {
              target.src = '/liga1-logo.png';
            }
          }}
          className="w-[18px] h-[18px] max-w-[18px] max-h-[18px] object-contain shrink-0"
        />
        <span className="text-[10px] font-medium text-slate-500 truncate">{clubName}</span>
      </div>

      {/* Col 5 (Similarity %) */}
      <span className="text-[12px] font-bold text-[#2ecc71] tabular-nums text-right font-sans shrink-0 px-1.5 py-1">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
};

export default SimilarPlayerRow;
