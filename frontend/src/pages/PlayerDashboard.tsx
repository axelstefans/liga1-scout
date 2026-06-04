import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePlayerProfile, usePlayerSeasonStats, usePlayerMatchStats, useTeamNextMatch } from '../hooks/usePlayer';

// Import components
import PlayerHeader from '../components/PlayerHeader';
import AttributeRadar from '../components/charts/AttributeRadar';
import PercentileBars from '../components/charts/PercentileBars';
import FormStrip from '../components/FormStrip';
import MatchTable from '../components/MatchTable';
import ScatterPlots from '../components/charts/ScatterPlots';
import TimeInPosition from '../components/TimeInPosition';
import SeasonHeatmap from '../components/SeasonHeatmap';
import KeyStrengths from '../components/KeyStrengths';

const PlayerDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playerId = id ? parseInt(id, 10) : 0;

  const [activeTab, setActiveTab] = useState<'overview' | 'match_log'>('overview');

  const { data: profile, isLoading: isProfileLoading } = usePlayerProfile(playerId);
  const teamId = profile?.team?.team_id;
  const { data: nextMatch, isLoading: isNextMatchLoading } = useTeamNextMatch(teamId);

  const { data: seasonStats, isLoading: isSeasonStatsLoading } = usePlayerSeasonStats(playerId);
  const { data: matchStats, isLoading: isMatchStatsLoading } = usePlayerMatchStats(playerId);

  if (isProfileLoading || isSeasonStatsLoading || isMatchStatsLoading) {
    return <div className="flex justify-center items-center h-64"><p className="text-xl text-navy">Loading player data...</p></div>;
  }

  if (!profile) {
    return <div className="text-center text-red-500 mt-10">Player not found.</div>;
  }

  const mainPosition = (() => {
    if (!matchStats || matchStats.length === 0) return undefined;
    const aliases: Record<string, string> = {
      'F': 'ST', 'CF': 'ST', 'D': 'CB', 'CD': 'CB', 'M': 'CM', 'G': 'GK'
    };
    const minsByPos: Record<string, number> = {};
    matchStats.forEach(m => {
      if (m.position && m.minutes_played) {
        let pos = m.position.toUpperCase();
        pos = aliases[pos] || pos;
        minsByPos[pos] = (minsByPos[pos] || 0) + m.minutes_played;
      }
    });
    const sorted = Object.entries(minsByPos).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : undefined;
  })();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <PlayerHeader profile={profile} mainPosition={mainPosition} />

      {/* Tabs */}
      <div className="border-b border-border flex space-x-8 px-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-1 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'overview'
              ? 'border-navy-blue text-navy'
              : 'border-transparent text-gray-500 hover:text-navy'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('match_log')}
          className={`py-2 px-1 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === 'match_log'
              ? 'border-navy-blue text-navy'
              : 'border-transparent text-gray-500 hover:text-navy'
          }`}
        >
          Match Log
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
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

              {/* Next Match Card */}
              <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
                 <h3 className="text-xl font-display mb-4 text-navy">NEXT MATCH</h3>
                 {isNextMatchLoading ? (
                    <p className="text-sm text-gray-500">Loading...</p>
                 ) : nextMatch ? (
                    <div className="flex items-center space-x-4 border border-border rounded p-3">
                       {nextMatch.opponent_logo_url ? (
                         <img src={nextMatch.opponent_logo_url} alt={nextMatch.opponent_name} className="w-8 h-8 object-contain" />
                       ) : (
                         <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-xs font-bold text-gray-500">
                           {nextMatch.opponent_name.substring(0,3)}
                         </div>
                       )}
                       <div className="flex flex-col flex-1">
                         <span className="font-bold text-navy text-sm">{nextMatch.opponent_name}</span>
                         <span className="text-xs text-gray-500">
                            {(() => {
                              const date = new Date(nextMatch.match_date);
                              const dayMonth = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                              if (nextMatch.match_date.includes('T') && !nextMatch.match_date.includes('00:00:00')) {
                                 const hours = date.getHours().toString().padStart(2, '0');
                                 const mins = date.getMinutes().toString().padStart(2, '0');
                                 return `${dayMonth} · ${hours}:${mins}`;
                              }
                              return dayMonth;
                            })()}
                         </span>
                       </div>
                       <span className={`px-2 py-1 text-xs font-bold rounded ${nextMatch.home_away === 'H' ? 'bg-navy text-white' : 'bg-gray-200 text-gray-600'}`}>
                         {nextMatch.home_away}
                       </span>
                    </div>
                 ) : (
                    <p className="text-sm text-gray-500">No upcoming matches scheduled</p>
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

            {/* Right Column: Time In Position */}
            <div className="lg:col-span-1">
              <TimeInPosition matchStats={matchStats} />
            </div>
          </div>

          {/* Bottom Row: Distribution Scatter Plots & Heatmap */}
          <div className="mt-6 space-y-6">
            {seasonStats && (
              <ScatterPlots 
                playerId={playerId} 
                playerName={profile.name} 
                playerStats={seasonStats} 
                positionGroup={profile.position_group}
                position={mainPosition || profile.position}
              />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <SeasonHeatmap playerId={playerId} />
              </div>
              <div className="lg:col-span-5">
                <KeyStrengths profile={profile} seasonStats={seasonStats} mainPosition={mainPosition || profile.position} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'match_log' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-display mb-4 text-navy">Match History</h3>
            
            {/* Summary Bar */}
            {seasonStats && (
              <div className="flex flex-wrap gap-6 mb-6 p-4 bg-cream rounded border border-border">
                <div className="flex flex-col">
                   <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Appearances</span>
                   <span className="text-lg font-bold text-navy">{seasonStats.appearances ?? '-'}</span>
                </div>
                <div className="flex flex-col">
                   <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Goals</span>
                   <span className="text-lg font-bold text-navy">{seasonStats.goals ?? '-'}</span>
                </div>
                <div className="flex flex-col">
                   <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Assists</span>
                   <span className="text-lg font-bold text-navy">{seasonStats.assists ?? '-'}</span>
                </div>
                <div className="flex flex-col">
                   <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Avg Rating</span>
                   <span className="text-lg font-bold text-navy">{seasonStats.rating?.toFixed(2) ?? '-'}</span>
                </div>
              </div>
            )}

            {matchStats && matchStats.length > 0 ? (
               <MatchTable matches={matchStats} />
            ) : (
               <p className="text-sm text-gray-500">No match data available.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default PlayerDashboard;
