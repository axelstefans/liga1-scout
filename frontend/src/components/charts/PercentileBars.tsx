import React from 'react';
import { PlayerSeasonStats } from '../../services/api';

interface PercentileBarsProps {
  stats: PlayerSeasonStats;
  positionGroup: string | null;
  themeColor?: string;
}

// Temporary max bounds for calculating internal pseudo-percentiles
const MAX_BOUNDS: Record<string, number> = {
  goals: 25,
  assists: 15,
  key_passes: 60,
  successful_dribbles: 80,
  tackles: 100,
  interceptions: 80,
  accurate_passes_percentage: 100,
  ground_duels_won_percentage: 100,
  rating: 10,
  minutes_played: 3000
};

const Bar: React.FC<{ label: string; value: number | null; max: number; isPercent?: boolean; themeColor?: string }> = ({ label, value, max, isPercent, themeColor }) => {
  const val = value || 0;
  // If it's a percentage stat, don't divide by max if it's already out of 100
  const fillPct = isPercent ? val : Math.min((val / max) * 100, 100);
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1 font-medium text-navy">
        <span>{label}</span>
        <span>{isPercent ? `${val.toFixed(1)}%` : val.toFixed(1)}</span>
      </div>
      <div className="w-full bg-cream rounded-full h-2.5 border border-border">
        <div className="h-2.5 rounded-full" style={{ width: `${fillPct}%`, backgroundColor: themeColor || '#1e3a8a' }}></div>
      </div>
    </div>
  );
};

const PercentileBars: React.FC<PercentileBarsProps> = ({ stats, positionGroup, themeColor }) => {
  const isGoalkeeper = positionGroup === 'Goalkeeper';
  const isDefender = positionGroup === 'Defender';
  const isMidfielder = positionGroup === 'Midfielder';
  
  return (
    <div className="space-y-2">
      <Bar label="Minutes Played" value={stats.minutes_played} max={MAX_BOUNDS.minutes_played} themeColor={themeColor} />
      <Bar label="Rating" value={stats.rating} max={MAX_BOUNDS.rating} themeColor={themeColor} />
      
      {!isGoalkeeper && (
        <>
          <Bar label="Goals" value={stats.goals} max={MAX_BOUNDS.goals} themeColor={themeColor} />
          <Bar label="Assists" value={stats.assists} max={MAX_BOUNDS.assists} themeColor={themeColor} />
          <Bar label="Key Passes" value={stats.key_passes} max={MAX_BOUNDS.key_passes} themeColor={themeColor} />
        </>
      )}

      {(isMidfielder || isDefender) && (
        <>
          <Bar label="Tackles" value={stats.tackles} max={MAX_BOUNDS.tackles} themeColor={themeColor} />
          <Bar label="Interceptions" value={stats.interceptions} max={MAX_BOUNDS.interceptions} themeColor={themeColor} />
        </>
      )}

      {!isGoalkeeper && (
         <Bar label="Successful Dribbles" value={stats.successful_dribbles} max={MAX_BOUNDS.successful_dribbles} themeColor={themeColor} />
      )}

      <Bar label="Pass Accuracy" value={stats.accurate_passes_percentage} max={MAX_BOUNDS.accurate_passes_percentage} isPercent themeColor={themeColor} />
      <Bar label="Ground Duels Won" value={stats.ground_duels_won_percentage} max={MAX_BOUNDS.ground_duels_won_percentage} isPercent themeColor={themeColor} />
      
      {isGoalkeeper && (
        <>
          <Bar label="Saves" value={stats.saves} max={150} themeColor={themeColor} />
          <Bar label="Clean Sheets" value={stats.clean_sheets} max={20} themeColor={themeColor} />
        </>
      )}
    </div>
  );
};

export default PercentileBars;
