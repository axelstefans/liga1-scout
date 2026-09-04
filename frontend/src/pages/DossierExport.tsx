import React from 'react';
import { useParams } from 'react-router-dom';
import { usePlayerProfile, usePlayerSeasonStats, usePlayerMatchStats } from '../hooks/usePlayer';

// Import components
import DossierPlayerCard from '../components/DossierPlayerCard';
import DossierRadar from '../components/DossierRadar';
import PercentileBars from '../components/charts/PercentileBars';
import MatchTable from '../components/MatchTable';
import ScatterPlots from '../components/charts/ScatterPlots';
import TimeInPosition from '../components/TimeInPosition';
import SeasonHeatmap from '../components/SeasonHeatmap';
import DefendingTab from '../components/DefendingTab'; // Used for the Zonal Grid logic inside

const DossierExport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playerId = id ? parseInt(id, 10) : 0;

  const { data: profile, isLoading: isProfileLoading } = usePlayerProfile(playerId);
  const { data: seasonStats, isLoading: isSeasonStatsLoading } = usePlayerSeasonStats(playerId);
  const { data: matchStats, isLoading: isMatchStatsLoading } = usePlayerMatchStats(playerId);

  if (isProfileLoading || isSeasonStatsLoading || isMatchStatsLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading dossier data...</p></div>;
  }

  if (!profile || !seasonStats) {
    return <div className="text-center text-red-500 mt-10">Data not found.</div>;
  }

  // Placeholder theme color
  const themeColor = profile.team?.primary_color || '#0ea5e9';

  return (
    <div className="w-full h-screen overflow-auto bg-gray-900 p-8 flex justify-center">
      <div 
        className="shrink-0 bg-[#f8fafc]"
        style={{ 
          width: '1920px', 
          height: '2400px', 
          padding: '40px',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '24px'
        }}
      >
        {/* ROW 1: 4 Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Player ID</h2>
            <DossierPlayerCard profile={profile} themeColor={themeColor} />
          </div>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200 flex flex-col">
            <h2 className="text-xl font-bold mb-4">Polar Radar (Grouped)</h2>
            <div className="grow">
              <DossierRadar stats={seasonStats} themeColor={themeColor} />
            </div>
          </div>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Top 10 Similar (Placeholder)</h2>
            {/* Using MatchTable as a placeholder for a list UI */}
            {matchStats && <MatchTable matches={matchStats.slice(0, 5)} />}
          </div>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Time in Position</h2>
            {matchStats && <TimeInPosition matches={matchStats} />}
          </div>
        </div>

        {/* ROW 2: 2 Columns conceptually, but let's do a left column (1fr) and right column (3fr) to fit 6 mini pitches */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '24px' }}>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Similarity Table (Placeholder)</h2>
            <PercentileBars stats={seasonStats} positionGroup={profile.position_group || 'Unknown'} themeColor={themeColor} />
          </div>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">6 Mini-Pitch Spatial Maps</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '16px' }}>
              <SeasonHeatmap playerId={playerId} themeColor={themeColor} />
              <SeasonHeatmap playerId={playerId} themeColor="#10b981" />
              <SeasonHeatmap playerId={playerId} themeColor="#3b82f6" />
              <SeasonHeatmap playerId={playerId} themeColor="#8b5cf6" />
              <SeasonHeatmap playerId={playerId} themeColor="#f59e0b" />
              <SeasonHeatmap playerId={playerId} themeColor="#ef4444" />
            </div>
          </div>
        </div>

        {/* ROW 3: 4 Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200 col-span-2">
            <h2 className="text-xl font-bold mb-4">1D Beeswarm Plots (Placeholder)</h2>
            <div className="flex gap-4">
              <PercentileBars stats={seasonStats} positionGroup={profile.position_group || 'Unknown'} themeColor={themeColor} />
              <PercentileBars stats={seasonStats} positionGroup={profile.position_group || 'Unknown'} themeColor={themeColor} />
            </div>
          </div>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">2D Scatter Plot</h2>
            <ScatterPlots stats={seasonStats} positionGroup={profile.position_group || 'Unknown'} themeColor={themeColor} />
          </div>
          <div className="bg-white p-4 rounded shadow-sm border border-gray-200 overflow-hidden">
            <h2 className="text-xl font-bold mb-4">Defensive Zonal Grid (Extracting from Tab)</h2>
            {/* The actual grid needs to be extracted, using DefendingTab just as placeholder for now */}
            <div className="scale-75 origin-top-left w-[133%]">
                <DefendingTab playerId={playerId} themeColor={themeColor} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DossierExport;
