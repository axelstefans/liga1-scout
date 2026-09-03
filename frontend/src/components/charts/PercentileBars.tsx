import React from 'react';
import { PlayerSeasonStats } from '../../services/api';

interface PercentileBarsProps {
  stats: PlayerSeasonStats;
  positionGroup: string | null;
  themeColor?: string;
}

const Bar: React.FC<{ label: string; value: number | null; pctValue?: number | null; isPercent?: boolean; themeColor?: string }> = ({ label, value, pctValue, isPercent, themeColor }) => {
  if (pctValue === null || pctValue === undefined) return null;
  const val = value || 0;
  const fillPct = pctValue;
  
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
      <Bar label="Minutes Played" value={stats.minutes_played} pctValue={stats.minutes_played_pct} themeColor={themeColor} />
      <Bar label="Rating" value={stats.rating} pctValue={stats.rating_pct} themeColor={themeColor} />
      
      {!isGoalkeeper && (
        <>
          <Bar label="Goals" value={stats.goals} pctValue={stats.goals_pct} themeColor={themeColor} />
          <Bar label="Assists" value={stats.assists} pctValue={stats.assists_pct} themeColor={themeColor} />
          <Bar label="Key Passes" value={stats.key_passes} pctValue={stats.key_passes_pct} themeColor={themeColor} />
        </>
      )}

      {(isMidfielder || isDefender) && (
        <>
          <Bar label="Tackles" value={stats.tackles} pctValue={stats.tackles_pct} themeColor={themeColor} />
          <Bar label="Interceptions" value={stats.interceptions} pctValue={stats.interceptions_pct} themeColor={themeColor} />
        </>
      )}

      {!isGoalkeeper && (
         <Bar label="Successful Dribbles" value={stats.successful_dribbles} pctValue={stats.successful_dribbles_pct} themeColor={themeColor} />
      )}

      <Bar label="Pass Accuracy" value={stats.accurate_passes_percentage} pctValue={stats.accurate_passes_percentage_pct} isPercent themeColor={themeColor} />
      <Bar label="Ground Duels Won" value={stats.ground_duels_won_percentage} pctValue={stats.ground_duels_won_percentage_pct} isPercent themeColor={themeColor} />
      
      {isGoalkeeper && (
        <>
          <Bar label="Saves" value={stats.saves} pctValue={stats.saves_pct} themeColor={themeColor} />
          <Bar label="Clean Sheets" value={stats.clean_sheets} pctValue={stats.clean_sheets_pct} themeColor={themeColor} />
        </>
      )}
    </div>
  );
};

export default PercentileBars;
