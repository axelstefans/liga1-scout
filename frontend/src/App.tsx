import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom';
import ScoutingReport from './pages/ScoutingReport';
import TeamLeagueAnalytics from './pages/TeamLeagueAnalytics';
import ClubDetailAnalytics from './pages/ClubDetailAnalytics';

function PlayerRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/scouting/${id}` : '/scouting'} replace />;
}

function AppContent() {
  const location = useLocation();
  const isScouting = location.pathname.startsWith('/scouting');
  const isTeams = location.pathname.startsWith('/teams');
  const isClubs = location.pathname.startsWith('/clubs');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-navy text-cream py-4 px-6 shadow-md flex items-center justify-between export-ignore">
        <Link to="/scouting" className="text-3xl m-0 font-display text-cream hover:text-white transition-colors tracking-wide">
          LIGA 1 SCOUT
        </Link>
        <nav className="flex items-center space-x-6">
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
          <Link
            to="/clubs"
            className={`uppercase font-medium text-sm tracking-wider pb-1 transition-all ${
              isClubs
                ? 'text-white border-b-2 border-cream font-bold'
                : 'text-cream/80 hover:text-white border-b-2 border-transparent'
            }`}
          >
            Clubes
          </Link>
        </nav>
      </header>
      <main className={isScouting || isClubs ? 'flex-grow' : 'flex-grow p-4 md:p-8'}>
        <Routes>
          <Route path="/" element={<Navigate to="/scouting" replace />} />
          <Route path="/player/:id" element={<PlayerRedirect />} />
          <Route path="/scouting" element={<ScoutingReport />} />
          <Route path="/scouting/:id" element={<ScoutingReport />} />
          <Route path="/teams" element={<TeamLeagueAnalytics />} />
          <Route path="/clubs" element={<ClubDetailAnalytics />} />
          <Route path="/clubs/:id" element={<ClubDetailAnalytics />} />
          <Route path="*" element={<Navigate to="/scouting" replace />} />
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
