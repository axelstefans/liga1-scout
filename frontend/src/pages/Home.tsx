import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { usePlayerSearch } from '../hooks/usePlayer';

const Home: React.FC = () => {
  const [query, setQuery] = useState('');
  const { data: players, isLoading } = usePlayerSearch(query);
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto mt-20">
      <h2 className="text-4xl font-display mb-6 text-center text-navy">Find a Player</h2>
      
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-4 border border-border rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-navy-blue focus:border-navy-blue sm:text-lg transition-shadow shadow-sm"
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading && query.length >= 2 && (
        <p className="text-center text-gray-500">Searching...</p>
      )}

      {players && players.length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-border">
          <ul className="divide-y divide-border">
            {players.map((player) => (
              <li key={player.player_id}>
                <button
                  onClick={() => navigate(`/player/${player.player_id}`)}
                  className="block w-full text-left hover:bg-cream transition duration-150 ease-in-out focus:outline-none focus:bg-cream"
                >
                  <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                    <div className="flex items-center">
                      {player.team_logo_url && (
                        <img 
                          src={player.team_logo_url} 
                          alt={player.team_name || 'Team logo'} 
                          className="h-10 w-10 rounded-full mr-4 object-contain"
                        />
                      )}
                      <div>
                        <p className="text-lg font-bold text-navy">{player.name}</p>
                        <p className="text-sm text-gray-500">
                          {player.position_group || 'Unknown Position'} &bull; {player.team_name || 'No Team'}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {players && players.length === 0 && query.length >= 2 && (
        <p className="text-center text-gray-500">No players found matching "{query}".</p>
      )}
    </div>
  );
};

export default Home;
