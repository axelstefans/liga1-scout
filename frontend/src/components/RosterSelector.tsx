import React, { useState, useEffect } from 'react';
import { fetchTeamRoster, PlayerPredictionStat } from '../services/api';

interface RosterSelectorProps {
  teamName: string | null;
  teamType: "Home" | "Away";
  onTotalXgChange: (totalXg: number) => void;
}

export const RosterSelector: React.FC<RosterSelectorProps> = ({ teamName, teamType, onTotalXgChange }) => {
  const [roster, setRoster] = useState<PlayerPredictionStat[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadRoster = async () => {
      if (!teamName) {
        setRoster([]);
        setSelectedIds([]);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchTeamRoster(teamName);
        if (isMounted) {
          setRoster(data);
          const top11Ids = data.slice(0, 11).map(p => p.player_id);
          setSelectedIds(top11Ids);
        }
      } catch (err) {
        console.error("Failed to fetch roster:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadRoster();
    
    return () => { isMounted = false; };
  }, [teamName]);

  useEffect(() => {
    if (roster.length === 0 || selectedIds.length === 0) {
      onTotalXgChange(0);
      return;
    }
    
    let sum = 0;
    roster.forEach(player => {
      if (selectedIds.includes(player.player_id)) {
        sum += player.xg90 || 0;
      }
    });
    
    onTotalXgChange(sum);
  }, [selectedIds, roster, onTotalXgChange]);

  const handleToggle = (playerId: number) => {
    if (selectedIds.includes(playerId)) {
      setSelectedIds(prev => prev.filter(id => id !== playerId));
    } else {
      if (selectedIds.length < 11) {
        setSelectedIds(prev => [...prev, playerId]);
      }
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg w-full border border-gray-700">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-gray-300">
          {teamType} Starting XI <span className="text-sm font-normal text-gray-500">(Select 11)</span>
        </h3>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-bold text-blue-400">
            {selectedIds.length}/11
          </span>
          <button 
            type="button"
            onClick={() => setSelectedIds([])} 
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-gray-400 text-sm text-center py-8">Loading roster...</div>
      ) : roster.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8">No team selected.</div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
          {roster.map((player) => {
            const isSelected = selectedIds.includes(player.player_id);
            const isDisabled = !isSelected && selectedIds.length >= 11;
            
            return (
              <label 
                key={player.player_id} 
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-gray-700 border border-gray-600' : 'hover:bg-gray-700/50 border border-transparent'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-500 rounded bg-gray-900 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                    checked={isSelected}
                    onChange={() => handleToggle(player.player_id)}
                    disabled={isDisabled}
                  />
                  <div className="flex flex-col truncate">
                    <span className="text-white text-sm truncate" title={player.player_name}>{player.player_name}</span>
                    <span className="text-gray-400 text-xs">{player.position || "Unknown"}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 ml-2">
                  <span className="text-green-400 font-bold text-sm">{player.xg90.toFixed(2)}</span>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
