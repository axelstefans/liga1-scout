import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import PlayerDashboard from './pages/PlayerDashboard';
import ScoutingReport from './pages/ScoutingReport';
import TeamLeagueAnalytics from './pages/TeamLeagueAnalytics';

function AppContent() {
  const location = useLocation();
  const isScouting = location.pathname.startsWith('/scouting');
  const isTeams = location.pathname.startsWith('/teams');
  const isSearch = !isScouting && !isTeams;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-navy text-cream py-4 px-6 shadow-md flex items-center justify-between export-ignore">
        <Link to="/" className="text-3xl m-0 font-display text-cream hover:text-white transition-colors tracking-wide">
          LIGA 1 SCOUT
        </Link>
        <nav className="flex items-center space-x-6">
          <Link
            to="/"
            className={`uppercase font-medium text-sm tracking-wider pb-1 transition-all ${
              isSearch
                ? 'text-white border-b-2 border-cream font-bold'
                : 'text-cream/80 hover:text-white border-b-2 border-transparent'
            }`}
          >
            Search
          </Link>
          <Link
            to="/scouting"
            className={`uppercase font-medium text-sm tracking-wider pb-1 transition-all ${
              isScouting
                ? 'text-white border-b-2 border-cream font-bold'
                : 'text-cream/80 hover:text-white border-b-2 border-transparent'
            }`}
          >
            Scouting
          </Link>
          <Link
            to="/teams"
            className={`uppercase font-medium text-sm tracking-wider pb-1 transition-all ${
              isTeams
                ? 'text-white border-b-2 border-cream font-bold'
                : 'text-cream/80 hover:text-white border-b-2 border-transparent'
            }`}
          >
            Equipos y Liga
          </Link>
        </nav>
      </header>
      <main className={isScouting ? 'flex-grow' : 'flex-grow p-4 md:p-8'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/player/:id" element={<PlayerDashboard />} />
          <Route path="/scouting" element={<ScoutingReport />} />
          <Route path="/scouting/:id" element={<ScoutingReport />} />
          <Route path="/teams" element={<TeamLeagueAnalytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
