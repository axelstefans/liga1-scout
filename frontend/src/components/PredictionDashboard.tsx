import React, { useState, useEffect } from 'react';
import { simulateMatch, PredictionResponse, teamsApi } from '../services/api';
import { RosterSelector } from './RosterSelector';

export const PredictionDashboard: React.FC = () => {
  const [teamsList, setTeamsList] = useState<string[]>([]);
  const [homeTeam, setHomeTeam] = useState<string>('');
  const [awayTeam, setAwayTeam] = useState<string>('');
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [homeCustomXg, setHomeCustomXg] = useState<number>(0);
  const [awayCustomXg, setAwayCustomXg] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"global" | "tactical">("global");
  
  const [bookieHome, setBookieHome] = useState<string>('');
  const [bookieDraw, setBookieDraw] = useState<string>('');
  const [bookieAway, setBookieAway] = useState<string>('');
  const [bookieOver, setBookieOver] = useState<string>('');
  const [bookieUnder, setBookieUnder] = useState<string>('');

  useEffect(() => {
    teamsApi.getAll()
      .then(data => setTeamsList(data.map(t => t.name)))
      .catch(err => console.error("Failed to load teams:", err));
  }, []);

  const handleSwap = () => {
    setHomeTeam(awayTeam);
    setAwayTeam(homeTeam);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam) {
      setError("Please enter both home and away teams.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await simulateMatch(
        homeTeam, 
        awayTeam, 
        activeTab === "tactical" && homeCustomXg > 0 ? homeCustomXg : undefined, 
        activeTab === "tactical" && awayCustomXg > 0 ? awayCustomXg : undefined
      );
      setResult(data);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        err.message || 
        "An error occurred during simulation."
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const maxProb = result ? Math.max(
    result.probabilities_percent.home,
    result.probabilities_percent.draw,
    result.probabilities_percent.away
  ) : 0;
  
  const isHighest = (val: number) => val === maxProb;

  const hasValue = (bookieStr: string, trueOdds: number) => {
    const bookie = parseFloat(bookieStr);
    return !isNaN(bookie) && bookie > trueOdds;
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg shadow-xl w-full max-w-4xl mx-auto border border-gray-800">
      <h2 className="text-2xl font-bold mb-6 text-blue-400">Match Predictor (Poisson Model)</h2>

      <form onSubmit={handleSimulate} className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1" htmlFor="homeTeam">Home Team</label>
            <select 
              id="homeTeam"
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
            >
              <option value="" disabled>Select a team...</option>
              {teamsList.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
        
        <div className="flex justify-center pb-1">
          <button 
            type="button" 
            onClick={handleSwap}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-2 rounded-full transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Swap Teams"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
            </svg>
          </button>
        </div>

        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1" htmlFor="awayTeam">Away Team</label>
          <select 
            id="awayTeam"
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
          >
            <option value="" disabled>Select a team...</option>
            {teamsList.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
      </div>

        <div className="flex justify-center mt-6 mb-6">
          <div className="bg-gray-800 p-1 rounded-lg inline-flex shadow-inner border border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab("global")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                activeTab === "global" 
                  ? "bg-blue-600 text-white shadow" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Global Prediction
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tactical")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                activeTab === "tactical" 
                  ? "bg-blue-600 text-white shadow" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Tactical Setup
            </button>
          </div>
        </div>

        {activeTab === "tactical" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <RosterSelector 
              teamName={homeTeam || null} 
              teamType="Home" 
              onTotalXgChange={setHomeCustomXg} 
            />
            <RosterSelector 
              teamName={awayTeam || null} 
              teamType="Away" 
              onTotalXgChange={setAwayCustomXg} 
            />
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 px-6 rounded transition-colors"
          >
            {loading ? 'Calculating...' : 'Run Simulation'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6">
          {error}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Projected Goals */}
          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300 mb-4 border-b border-gray-700 pb-2">Projected Goals (xG)</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Home</span>
              <span className="text-2xl font-bold text-white">{result.projected_goals.home.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Away</span>
              <span className="text-2xl font-bold text-white">{result.projected_goals.away.toFixed(2)}</span>
            </div>
          </div>

          {/* Card 2: Match Winner Odds */}
          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-300 mb-4 border-b border-gray-700 pb-2">Match Winner (1X2)</h3>
            <div className="flex justify-between items-center mb-2">
              <span className={isHighest(result.probabilities_percent.home) ? "text-green-400 font-bold" : "text-gray-400"}>Home</span>
              <div className="text-right">
                <span className={`text-lg font-bold ${isHighest(result.probabilities_percent.home) ? "text-green-400" : "text-white"}`}>{result.match_winner_odds.home.toFixed(2)}</span>
                <span className={`text-sm ml-2 ${isHighest(result.probabilities_percent.home) ? "text-green-400 font-bold" : "text-gray-500"}`}>({result.probabilities_percent.home}%)</span>
              </div>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className={isHighest(result.probabilities_percent.draw) ? "text-green-400 font-bold" : "text-gray-400"}>Draw</span>
              <div className="text-right">
                <span className={`text-lg font-bold ${isHighest(result.probabilities_percent.draw) ? "text-green-400" : "text-white"}`}>{result.match_winner_odds.draw.toFixed(2)}</span>
                <span className={`text-sm ml-2 ${isHighest(result.probabilities_percent.draw) ? "text-green-400 font-bold" : "text-gray-500"}`}>({result.probabilities_percent.draw}%)</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className={isHighest(result.probabilities_percent.away) ? "text-green-400 font-bold" : "text-gray-400"}>Away</span>
              <div className="text-right">
                <span className={`text-lg font-bold ${isHighest(result.probabilities_percent.away) ? "text-green-400" : "text-white"}`}>{result.match_winner_odds.away.toFixed(2)}</span>
                <span className={`text-sm ml-2 ${isHighest(result.probabilities_percent.away) ? "text-green-400 font-bold" : "text-gray-500"}`}>({result.probabilities_percent.away}%)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Over/Under 2.5 Goals */}
          <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-300 mb-4 border-b border-gray-700 pb-2">Over/Under 2.5 Goals</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-gray-400 text-sm mb-1">Over 2.5</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-white">{result.over_under_25_odds.over.toFixed(2)}</span>
                  <span className="text-gray-500">({result.probabilities_percent.over_25}%)</span>
                </div>
                <div className="w-full bg-gray-700 h-2 rounded-full mt-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${result.probabilities_percent.over_25}%` }}></div>
                </div>
              </div>
              <div>
                <span className="block text-gray-400 text-sm mb-1">Under 2.5</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-white">{result.over_under_25_odds.under.toFixed(2)}</span>
                  <span className="text-gray-500">({result.probabilities_percent.under_25}%)</span>
                </div>
                <div className="w-full bg-gray-700 h-2 rounded-full mt-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${result.probabilities_percent.under_25}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      )}

      {result && (
        <div className="mt-6 bg-gray-800 p-5 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-blue-400 mb-4 border-b border-gray-700 pb-2">Value Bets Scanner</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 1X2 Market */}
            <div>
              <h4 className="text-md font-medium text-gray-300 mb-3">1X2 Market</h4>
              <div className="space-y-3">
                {/* Home */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400 w-16">Home</label>
                  <input 
                    type="number" step="0.01" min="1.01" placeholder="Odds..."
                    className={`w-24 bg-gray-900 border rounded p-1 text-white text-sm focus:outline-none transition-colors ${
                      hasValue(bookieHome, result.match_winner_odds.home) ? "border-green-500" : "border-gray-600 focus:border-blue-500"
                    }`}
                    value={bookieHome} onChange={e => setBookieHome(e.target.value)}
                  />
                  <div className="w-24 text-right">
                    {hasValue(bookieHome, result.match_winner_odds.home) && (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded font-bold">VALUE</span>
                    )}
                  </div>
                </div>
                {/* Draw */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400 w-16">Draw</label>
                  <input 
                    type="number" step="0.01" min="1.01" placeholder="Odds..."
                    className={`w-24 bg-gray-900 border rounded p-1 text-white text-sm focus:outline-none transition-colors ${
                      hasValue(bookieDraw, result.match_winner_odds.draw) ? "border-green-500" : "border-gray-600 focus:border-blue-500"
                    }`}
                    value={bookieDraw} onChange={e => setBookieDraw(e.target.value)}
                  />
                  <div className="w-24 text-right">
                    {hasValue(bookieDraw, result.match_winner_odds.draw) && (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded font-bold">VALUE</span>
                    )}
                  </div>
                </div>
                {/* Away */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400 w-16">Away</label>
                  <input 
                    type="number" step="0.01" min="1.01" placeholder="Odds..."
                    className={`w-24 bg-gray-900 border rounded p-1 text-white text-sm focus:outline-none transition-colors ${
                      hasValue(bookieAway, result.match_winner_odds.away) ? "border-green-500" : "border-gray-600 focus:border-blue-500"
                    }`}
                    value={bookieAway} onChange={e => setBookieAway(e.target.value)}
                  />
                  <div className="w-24 text-right">
                    {hasValue(bookieAway, result.match_winner_odds.away) && (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded font-bold">VALUE</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Goals Market */}
            <div>
              <h4 className="text-md font-medium text-gray-300 mb-3">Goals Market (2.5)</h4>
              <div className="space-y-3">
                {/* Over */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400 w-16">Over</label>
                  <input 
                    type="number" step="0.01" min="1.01" placeholder="Odds..."
                    className={`w-24 bg-gray-900 border rounded p-1 text-white text-sm focus:outline-none transition-colors ${
                      hasValue(bookieOver, result.over_under_25_odds.over) ? "border-green-500" : "border-gray-600 focus:border-blue-500"
                    }`}
                    value={bookieOver} onChange={e => setBookieOver(e.target.value)}
                  />
                  <div className="w-24 text-right">
                    {hasValue(bookieOver, result.over_under_25_odds.over) && (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded font-bold">VALUE</span>
                    )}
                  </div>
                </div>
                {/* Under */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400 w-16">Under</label>
                  <input 
                    type="number" step="0.01" min="1.01" placeholder="Odds..."
                    className={`w-24 bg-gray-900 border rounded p-1 text-white text-sm focus:outline-none transition-colors ${
                      hasValue(bookieUnder, result.over_under_25_odds.under) ? "border-green-500" : "border-gray-600 focus:border-blue-500"
                    }`}
                    value={bookieUnder} onChange={e => setBookieUnder(e.target.value)}
                  />
                  <div className="w-24 text-right">
                    {hasValue(bookieUnder, result.over_under_25_odds.under) && (
                      <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded font-bold">VALUE</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
