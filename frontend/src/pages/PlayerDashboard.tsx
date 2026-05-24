import React from 'react';
import { useParams } from 'react-router-dom';
import { usePlayerProfile, usePlayerSeasonStats, usePlayerMatchStats } from '../hooks/usePlayer';

// Import components (we will create these next)
import PlayerHeader from '../components/PlayerHeader';
import AttributeRadar from '../components/charts/AttributeRadar';
import PercentileBars from '../components/charts/PercentileBars';
import FormStrip from '../components/FormStrip';
import MatchTable from '../components/MatchTable';
import ScatterPlots from '../components/charts/ScatterPlots';

const PlayerDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playerId = id ? parseInt(id, 10) : 0;

  const { data: profile, isLoading: isProfileLoading } = usePlayerProfile(playerId);
  const { data: seasonStats, isLoading: isSeasonStatsLoading } = usePlayerSeasonStats(playerId);
  const { data: matchStats, isLoading: isMatchStatsLoading } = usePlayerMatchStats(playerId);

  if (isProfileLoading || isSeasonStatsLoading || isMatchStatsLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading player data...</p></div>;
  }

  if (!profile) {
    return <div className="text-center text-red-500 mt-10">Player not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <PlayerHeader profile={profile} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Radar and Form */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-display mb-4 text-navy">Attribute Profile</h3>
            {seasonStats ? (
               <AttributeRadar stats={seasonStats} positionGroup={profile.position_group} />
            ) : (
               <p className="text-sm text-gray-500">No season stats available for radar.</p>
            )}
          </div>

          <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
             <h3 className="text-xl font-display mb-4 text-navy">Recent Form</h3>
             {matchStats && matchStats.length > 0 ? (
                <FormStrip matches={matchStats} />
             ) : (
                <p className="text-sm text-gray-500">No match data available.</p>
             )}
          </div>
        </div>

        {/* Middle Column: Percentiles */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm lg:col-span-1">
          <h3 className="text-xl font-display mb-4 text-navy">League Percentiles</h3>
          {seasonStats ? (
            <PercentileBars stats={seasonStats} positionGroup={profile.position_group} />
          ) : (
            <p className="text-sm text-gray-500">No season stats available.</p>
          )}
        </div>

        {/* Right Column: Match History Table */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-sm lg:col-span-1">
          <h3 className="text-xl font-display mb-4 text-navy">Match History</h3>
          {matchStats && matchStats.length > 0 ? (
             <MatchTable matches={matchStats} />
          ) : (
             <p className="text-sm text-gray-500">No match data available.</p>
          )}
        </div>
      </div>

      {/* Bottom Row: Distribution Scatter Plots */}
      {seasonStats && (
        <div className="mt-6">
          <ScatterPlots 
            playerId={playerId} 
            playerName={profile.name} 
            playerStats={seasonStats} 
          />
        </div>
      )}
    </div>
  );
};

export default PlayerDashboard;
